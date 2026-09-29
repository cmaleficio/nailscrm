"""
graphify: reconstruccion incremental del grafo de conocimiento.

Corre la parte DETERMINISTA del pipeline de graphify (detect -> AST ->
cache semantico -> merge -> build -> cluster -> etiquetar -> html ->
manifest) y deja el grafo listo. El unico paso que necesita un LLM es la
extraccion semantica de los .md, y este script la pide solo cuando hace
falta: al final imprime la lista de documentos SIN cachear.

    # 1. rebuild (codigo + docs ya cacheados)
    python scripts/graphify_rebuild.py

    # 2. si imprime "FALTAN EXTRACCION SEMANTICA", despacha subagentes con
    #    la spec (C:\\...\\graphify\\skills\\opencode\\references\\
    #    extraction-spec.md) -> graphify-out/.graphify_chunk_NN.json
    #    y repite: python scripts/graphify_rebuild.py
    #    (ahora los chunks se cachean y el grafo se construye)

    # 3. cierre de la corrida
    python scripts/graphify_rebuild.py --finish

Por que NO `graphify update .`: ese subcomando llama a watch._rebuild_code,
que es SOLO codigo. Para los .md genera nodos estructurales a nivel de
encabezado (agents_comandos, agents_modelo_de_datos...) y tira los nodos a
nivel de entidad que generan los subagentes (agents_adminshell,
agents_api_appointments_delete). Medido el 2026-09-28: 2255 -> 2109 nodos,
216 nodos de doc perdidos. Este script lee la cache semantica y conserva todo.
"""

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(".")
OUT = ROOT / "graphify-out"
DETECT = OUT / ".graphify_detect.json"
AST = OUT / ".graphify_ast.json"
SEM_NEW = OUT / ".graphify_semantic_new.json"
SEM_CACHED = OUT / ".graphify_cached.json"
SEM = OUT / ".graphify_semantic.json"
EXTRACT = OUT / ".graphify_extract.json"
UNCACHED = OUT / ".graphify_uncached.txt"
EXTERNAL = ROOT / "scripts" / "graphify_external_deps.py"


def spec_path() -> Path:
    """Ruta de extraction-spec.md del paquete graphify instalado."""
    import graphify

    base = Path(graphify.__file__).parent
    for variant in ("opencode", "agents", "codex", "claude", "windows"):
        p = base / "skills" / variant / "references" / "extraction-spec.md"
        if p.exists():
            return p
    raise SystemExit(
        "ERROR: no se encontro extraction-spec.md en el paquete graphify.\n"
        "       Reinstala con: pip install --upgrade graphifyy"
    )


def run(label: str, code: str) -> None:
    print(f"\n=== {label} ===", flush=True)
    proc = subprocess.run(
        [sys.executable, "-c", code],
        cwd=ROOT,
        env={
            **__import__("os").environ,
            # Sin esto la consola cp1252 revienta al imprimir acentos del reporte.
            "PYTHONIOENCODING": "utf-8",
        },
    )
    if proc.returncode != 0:
        raise SystemExit(f"ERROR: '{label}' fallo (exit {proc.returncode}).")


# --- helpers de rutas para inyectar en los -c (todas POSIX, cero backslashes) ---
R = ROOT.resolve().as_posix()
O = OUT.as_posix()
SPEC = spec_path().as_posix()


def step_interpreter() -> None:
    OUT.mkdir(exist_ok=True)
    (OUT / ".graphify_python").write_text(sys.executable, encoding="utf-8")
    (OUT / ".graphify_root").write_text(str(ROOT.resolve()), encoding="utf-8")


def step_detect() -> None:
    run("Step 2 - detect", f"""
import json
from pathlib import Path
from graphify.detect import detect
r = detect(Path('{R}'))
Path('{O}/.graphify_detect.json').write_text(json.dumps(r, ensure_ascii=False), encoding='utf-8')
print(f"Detected {{r['total_files']}} files, {{r.get('total_words', 0):,}} words")
for cat, fl in r.get('files', {{}}).items():
    if fl:
        print(f"  {{cat:10s}} {{len(fl):4d}}")
""")


def step_ast() -> None:
    # parallel=False: en Windows el pool de multiprocessing revienta con
    # "OSError: [Errno 22] <stdin>" cuando el caller se pasa por stdin
    # (falta el guard `if __name__ == "__main__"`).
    run("Step 3A - AST (code)", f"""
import json
from pathlib import Path
from graphify.extract import collect_files, extract
d = json.loads(Path('{O}/.graphify_detect.json').read_text(encoding='utf-8'))
code = []
for f in d.get('files', {{}}).get('code', []):
    code.extend(collect_files(Path(f)) if Path(f).is_dir() else [Path(f)])
r = extract(code, cache_root=Path('{R}'), root=Path('{R}'), parallel=False)
Path('{O}/.graphify_ast.json').write_text(json.dumps(r, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"AST: {{len(r['nodes'])}} nodes, {{len(r['edges'])}} edges")
""")


def step_cache_check() -> list[str]:
    run("Step 3B0 - cache semantico", f"""
import json
from pathlib import Path
from graphify.cache import check_semantic_cache
SPEC = r'{SPEC}'
d = json.loads(Path('{O}/.graphify_detect.json').read_text(encoding='utf-8'))
docs = [f for cat in ('document', 'paper', 'image') for f in d['files'].get(cat, [])]
cn, ce, ch, uncached = check_semantic_cache(docs, root=Path('{R}'), prompt_file=SPEC)
if cn or ce or ch:
    Path('{O}/.graphify_cached.json').write_text(
        json.dumps({{'nodes': cn, 'edges': ce, 'hyperedges': ch}}, ensure_ascii=False),
        encoding='utf-8')
else:
    Path('{O}/.graphify_cached.json').unlink(missing_ok=True)
Path('{O}/.graphify_uncached.txt').write_text('\\n'.join(uncached), encoding='utf-8')
print(f"Cache: {{len(docs) - len(uncached)}} hit, {{len(uncached)}} pendientes")
""")
    return UNCACHED.read_text(encoding="utf-8").splitlines() if UNCACHED.exists() else []


def step_merge_chunks() -> bool:
    run("Step 3B3 - merge de chunks", f"""
import json, glob
from pathlib import Path
nodes, edges, hyper = [], [], []
for c in sorted(glob.glob('{O}/.graphify_chunk_*.json')):
    d = json.loads(Path(c).read_text(encoding='utf-8'))
    nodes += d.get('nodes', []); edges += d.get('edges', []); hyper += d.get('hyperedges', [])
Path('{O}/.graphify_semantic_new.json').write_text(json.dumps(
    {{'nodes': nodes, 'edges': edges, 'hyperedges': hyper,
      'input_tokens': 0, 'output_tokens': 0}}, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Chunks mergeados: {{len(nodes)}} nodos, {{len(edges)}} aristas, {{len(hyper)}} hyperedges")
""")
    return bool(list(OUT.glob(".graphify_chunk_*.json")))


def step_save_cache() -> None:
    run("Step 3B3 - guardar en cache", f"""
import json
from pathlib import Path
from graphify.cache import save_semantic_cache
SPEC = r'{SPEC}'
path = Path('{O}/.graphify_semantic_new.json')
if not path.exists():
    print('No hay chunks semanticos; nada que cachear')
    raise SystemExit(0)
new = json.loads(path.read_text(encoding='utf-8'))
uncached = [l for l in Path('{O}/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines() if l]
if uncached and new.get('nodes'):
    saved = save_semantic_cache(new.get('nodes', []), new.get('edges', []),
                                new.get('hyperedges', []), root=Path('{R}'),
                                allowed_source_files=uncached, prompt_file=SPEC)
    print(f'Cached {{saved}} files')
""")


def step_merge_semantic() -> None:
    run("Step 3C - merge AST + semantica (cache + chunks)", f"""
import json
from pathlib import Path
ast = json.loads(Path('{O}/.graphify_ast.json').read_text(encoding='utf-8'))
cached = json.loads(Path('{O}/.graphify_cached.json').read_text(encoding='utf-8')) \\
    if Path('{O}/.graphify_cached.json').exists() else {{}}
new = json.loads(Path('{O}/.graphify_semantic_new.json').read_text(encoding='utf-8')) \\
    if Path('{O}/.graphify_semantic_new.json').exists() else {{}}
seen = {{n['id'] for n in ast['nodes']}}
nodes = list(ast['nodes'])
for n in cached.get('nodes', []) + new.get('nodes', []):
    if n['id'] not in seen:
        nodes.append(n); seen.add(n['id'])
edges = ast.get('edges', []) + cached.get('edges', []) + new.get('edges', [])
hyper = cached.get('hyperedges', []) + new.get('hyperedges', [])
merged = {{'nodes': nodes, 'edges': edges, 'hyperedges': hyper,
          'input_tokens': (cached.get('input_tokens') or 0) + (new.get('input_tokens') or 0),
          'output_tokens': (cached.get('output_tokens') or 0) + (new.get('output_tokens') or 0)}}
Path('{O}/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
print(f"Merged: {{len(nodes)}} nodes, {{len(edges)}} edges "
      f"({{len(ast['nodes'])}} AST + {{len(cached.get('nodes', [])) + len(new.get('nodes', []))}} semantic)")
""")


def step_external_deps() -> None:
    run("Reparacion - dependencias externas", f"""
import runpy, sys
sys.argv = ['graphify_external_deps.py']
runpy.run_path(r'{EXTERNAL.as_posix()}', run_name='__main__')
""")


def step_build() -> None:
    run("Step 4 - build + cluster + reporte", f"""
import json
from pathlib import Path
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json

root = Path('{R}')
extraction = json.loads(Path('{O}/.graphify_extract.json').read_text(encoding='utf-8'))
detection  = json.loads(Path('{O}/.graphify_detect.json').read_text(encoding='utf-8'))
G = build_from_json(extraction, root=root, directed=False)
if G.number_of_nodes() == 0:
    raise SystemExit('ERROR: grafo vacio; la extraccion no produjo nodos.')
communities = cluster(G)
cohesion = score_all(G, communities)
tokens = {{'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}}
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {{cid: 'Community ' + str(cid) for cid in communities}}
questions = suggest_questions(G, communities, labels)

# force=True: el guard #479 (shrink-guard) bloquea la escritura cuando el
# grafo nuevo tiene menos nodos. En este repo eso pasa legitimo al excluir
# .agents/ (el codigo de graphify) y perder aliases mal resueltos; verificar
# SIEMPRE el delta por bucket antes de forzar.
prev = 0
p = Path('{O}/graph.json')
if p.exists():
    prev = len(json.loads(p.read_text(encoding='utf-8'))['nodes'])
    # respaldo del grafo anterior: las labels de las comunidades se
    # transfieren por solapamiento de nodos (nunca por id, cambian).
    Path('{O}/.graphify_prev_graph.json').write_text(
        Path('{O}/graph.json').read_text(encoding='utf-8'), encoding='utf-8')
if not to_json(G, communities, '{O}/graph.json', force=True):
    raise SystemExit('ERROR: to_json no escribio graph.json')
report = generate(G, communities, cohesion, labels, gods, surprises, detection, tokens,
                  '{R}', suggested_questions=questions)
Path('{O}/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('{O}/.graphify_analysis.json').write_text(json.dumps({{
    'communities': {{str(k): v for k, v in communities.items()}},
    'cohesion': {{str(k): v for k, v in cohesion.items()}},
    'gods': gods, 'surprises': surprises, 'questions': questions,
}}, indent=2, ensure_ascii=False), encoding='utf-8')
# No pisar labels buenas: si ya existe el archivo con nombres, se conserva
# (step_label_refresh las reutiliza / recupera contra el graph previo).
labels_path = Path('{O}/.graphify_labels.json')
existing = {{}}
if labels_path.exists():
    try:
        existing = json.loads(labels_path.read_text(encoding='utf-8'))
    except Exception:
        pass
named = {{k: v for k, v in existing.items() if not str(v).startswith('Community ')}}
if named:
    labels = {{str(cid): named.get(str(cid), 'Community ' + str(cid)) for cid in communities}}
labels_path.write_text(
    json.dumps({{str(k): v for k, v in labels.items()}}, ensure_ascii=False), encoding='utf-8')
print(f'Graph: {{G.number_of_nodes()}} nodes, {{G.number_of_edges()}} edges, '
      f'{{len(communities)}} communities (antes: {{prev}} nodos)')
""")


def step_health() -> None:
    run("Step 4.5 - health check", f"""
import json
from pathlib import Path
from graphify.diagnostics import diagnose_extraction
s = diagnose_extraction(json.loads(Path('{O}/.graphify_extract.json').read_text(encoding='utf-8')),
                        directed=False, root=Path('{R}'))
for k in ('missing_endpoint_edges', 'dangling_endpoint_edges', 'self_loop_edges'):
    print(f'  {{k}}: {{s.get(k, 0)}}')
dang = s.get('dangling_endpoint_edges', 0)
print('Graph health: OK' if not dang else
      f'GRAPH HEALTH WARNING: {{dang}} aristas colgantes. Ver abajo: son aliases')
print('  del extractor AST (src_db_index_schema, src_lib_auth_auth, ...) que no')
print('  tienen nodo. Benignas, pero hacen que query las pierda en silencio.')
""")


def step_label_refresh() -> None:
    """Recupera o reetiqueta las comunidades que quedaron como 'Community N'."""
    run("Step 5 - reetiquetar comunidades", f"""
import json, collections
from pathlib import Path
from graphify.build import build_from_json
from graphify.analyze import suggest_questions
from graphify.report import generate
from graphify.export import to_json

root = Path('{R}')
extraction = json.loads(Path('{O}/.graphify_extract.json').read_text(encoding='utf-8'))
detection  = json.loads(Path('{O}/.graphify_detect.json').read_text(encoding='utf-8'))
analysis   = json.loads(Path('{O}/.graphify_analysis.json').read_text(encoding='utf-8'))
prev_path = Path('{O}/.graphify_labels.json')
prev = json.loads(prev_path.read_text(encoding='utf-8')) if prev_path.exists() else {{}}

# Transfer de labels del grafo anterior por SOLAPAMIENTO de nodos: cada nodo
# del graph viejo lleva community + community_name. Con que el hub de la
# comunidad nueva venga de una comunidad vieja con nombre, recupera la label.
old_path = Path('{O}/.graphify_prev_graph.json')
if old_path.exists() and not any(not v.startswith('Community ') for v in prev.values()):
    old = json.loads(old_path.read_text(encoding='utf-8'))
    old_label = {{}}
    old_members = collections.defaultdict(set)
    for nd in old['nodes']:
        c = str(nd.get('community'))
        if nd.get('community_name'):
            old_label[c] = nd['community_name']
        old_members[c].add(nd['id'])
    new_members = collections.defaultdict(set)
    for nd in json.loads(Path('{O}/graph.json').read_text(encoding='utf-8'))['nodes']:
        new_members[str(nd.get('community'))].add(nd['id'])
    recovered = {{}}
    for nc, members in new_members.items():
        votes = collections.Counter()
        for nid in members:
            for oc, om in old_members.items():
                if nid in om:
                    votes[oc] += 1
        best = votes.most_common(1)
        if best and old_label.get(best[0][0]):
            recovered[nc] = old_label[best[0][0]]
    prev = {{**prev, **{{k: v for k, v in recovered.items()
                          if not v.startswith('Community ')}}}}
    print(f'Labels recuperadas del grafo anterior: {{sum(1 for v in recovered.values() if not v.startswith("Community "))}}')

G = build_from_json(extraction, root=root, directed=False)
communities = {{int(k): v for k, v in analysis['communities'].items()}}
cohesion = {{int(k): v for k, v in analysis['cohesion'].items()}}
tokens = {{'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}}

# Reutiliza el nombre previo cuando la comunidad conserva su hub; si no,
# queda 'Community N' y hay que nombrarla a mano en el reporte.
labels = {{}}
for cid in communities:
    old = prev.get(str(cid))
    labels[cid] = old if old and not old.startswith('Community ') else 'Community ' + str(cid)
todo = [c for c, l in labels.items() if l.startswith('Community ')]
if todo:
    print(f'REETIQUETAR {{len(todo)}} comunidades a mano (ids): {{todo}}')
questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'],
                  detection, tokens, '{R}', suggested_questions=questions)
Path('{O}/GRAPH_REPORT.md').write_text(report, encoding='utf-8')
Path('{O}/.graphify_labels.json').write_text(
    json.dumps({{str(k): v for k, v in labels.items()}}, ensure_ascii=False), encoding='utf-8')
to_json(G, communities, '{O}/graph.json', community_labels=labels, force=True)
print('Reporte regenerado')
""")


def step_html() -> None:
    run("Step 6 - graph.html", f"""
import sys
from graphify.cli import dispatch_command
sys.argv = ['graphify', 'export', 'html']
dispatch_command('export')
""")


def step_manifest() -> None:
    run("Step 9 - manifest + cost.json", f"""
import json
from pathlib import Path
from datetime import datetime, timezone
from graphify.detect import save_manifest
from graphify.cli import _stamped_manifest_files

root = Path('{R}')
detect = json.loads(Path('{O}/.graphify_detect.json').read_text(encoding='utf-8'))
extract = json.loads(Path('{O}/.graphify_extract.json').read_text(encoding='utf-8'))
corpus = detect.get('all_files') or detect['files']
manifest_files = _stamped_manifest_files(corpus, extract, root)
dispatched = {{f for t, fl in detect['files'].items() if t in ('document', 'paper', 'image') for f in fl}}
stamped = {{f for fl in manifest_files.values() for f in fl}}
scan = {{f for fl in corpus.values() for f in fl}}
save_manifest(manifest_files, manifest_path='{O}/manifest.json', root=root, scan_corpus=scan,
              clear_semantic=(dispatched - stamped) or None)

cost_path = Path('{O}/cost.json')
cost = json.loads(cost_path.read_text(encoding='utf-8')) if cost_path.exists() else \\
    {{'runs': [], 'total_input_tokens': 0, 'total_output_tokens': 0}}
i, o = extract.get('input_tokens', 0), extract.get('output_tokens', 0)
cost['runs'].append({{'date': datetime.now(timezone.utc).isoformat(),
                     'input_tokens': i, 'output_tokens': o,
                     'files': detect.get('total_files', 0)}})
cost['total_input_tokens'] += i
cost['total_output_tokens'] += o
cost_path.write_text(json.dumps(cost, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'costo: {{i:,}} in / {{o:,}} out | acumulado {{cost["total_input_tokens"]:,}} in / '
      f'{{cost["total_output_tokens"]:,}} out ({{len(cost["runs"])}} corridas)')
""")


def step_cleanup() -> None:
    for f in (DETECT, EXTRACT, AST, SEM, SEM_CACHED, SEM_NEW, UNCACHED,
              OUT / ".graphify_analysis.json", OUT / ".graphify_prev_graph.json",
              OUT / ".needs_update"):
        f.unlink(missing_ok=True)
    for c in OUT.glob(".graphify_chunk_*.json"):
        c.unlink()
    print("limpieza ok")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--finish", action="store_true",
                    help="solo cierre: reetiqueta, html, manifest y limpieza")
    args = ap.parse_args()

    step_interpreter()
    if args.finish:
        step_label_refresh()
        step_html()
        step_manifest()
        step_cleanup()
        return 0

    step_detect()
    step_ast()
    uncached = step_cache_check()
    if uncached and not any(OUT.glob(".graphify_chunk_*.json")):
        print("\n" + "=" * 70)
        print(f"FALTAN EXTRACCION SEMANTICA ({len(uncached)} docs) - despacha subagentes:")
        for u in uncached:
            print(f"  {u}")
        print(f"\nSpec: {SPEC}")
        print("Cada subagente escribe graphify-out/.graphify_chunk_NN.json,")
        print("y luego vuelves a correr este script (los chunks se cachean).")
        print("  python scripts/graphify_rebuild.py")
        print("=" * 70)
        return 2

    step_merge_chunks()
    step_save_cache()
    step_merge_semantic()
    step_external_deps()
    step_build()
    step_health()

    print("\n" + "=" * 70)
    if uncached:
        print("Subagentes despachados - reetiqueta en el cierre:")
    else:
        print("Todos los docs en cache. Cierra con:")
    print("  python scripts/graphify_rebuild.py --finish")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())