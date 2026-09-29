"""
Crea los nodos que faltan para las dependencias externas del grafo.

El extractor AST emite aristas `imports` / `imports_from` hacia modulos que
NO viven en el repo (npm, builtins de Node, modulos de Next). Nunca crea un
nodo para esos objetivos, asi que cada import externo deja la arista colgante
y las consultas la pierden en silencio: en el grafo del 2026-09-28 eran 307 de
485 endpoints colgantes, casi el 7% de todas las aristas.

Este script las cierra. No inventa relaciones: lee los `source_file` de las
aristas que ya existen y crea UN nodo por modulo externo, con la arista `imports`
como evidencia EXTRACTED de que ese archivo depende de el. Es una reparacion de
integridad, no una adicion semantica.

Uso (despues del merge AST + semantico, antes de build_from_json):
    python scripts/graphify_external_deps.py
"""

import json
import sys
from pathlib import Path

EXTRACT = Path("graphify-out/.graphify_extract.json")
PREFIX = "ref_"


def main() -> int:
    if not EXTRACT.exists():
        print(f"ERROR: {EXTRACT} no existe. Corre el merge (Step 3C) primero.")
        return 1

    extraction = json.loads(EXTRACT.read_text(encoding="utf-8"))
    nodes = extraction["nodes"]
    known = {n["id"] for n in nodes}

    # source_file del primer import que apunta a cada modulo, para poder citar
    # la evidencia y no dejar el nodo huerfano.
    evidence: dict[str, str] = {}
    for edge in extraction["edges"]:
        for endpoint in (edge.get("source"), edge.get("target")):
            if (
                endpoint
                and endpoint.startswith(PREFIX)
                and endpoint not in known
                and endpoint not in evidence
            ):
                evidence[endpoint] = edge.get("source_file") or ""

    if not evidence:
        print("External deps: nada que reparar (0 modulos externos colgantes).")
        return 0

    created = 0
    for node_id, importer in sorted(evidence.items()):
        if node_id in known:
            continue
        specifier = node_id[len(PREFIX) :]
        # `ref_node_fs_promises` -> node:fs/promises, `ref_next_navigation` -> next/navigation
        specifier = (
            specifier.replace("_", "/", 1)
            if specifier.startswith("node_")
            else specifier.replace("_", "/")
        )
        nodes.append(
            {
                "id": node_id,
                "label": specifier,
                "file_type": "code",
                "external": True,
                "source_file": importer,
                "source_location": None,
                "source_url": None,
                "captured_at": None,
                "author": None,
                "contributor": None,
            }
        )
        known.add(node_id)
        created += 1

    EXTRACT.write_text(
        json.dumps(extraction, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"External deps: {created} nodos creados para modulos externos.")
    print(f"Total nodos: {len(nodes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
