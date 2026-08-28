# Skills - Nails App

## Graphify

**Instalado:** `graphify-labs/graphify@graphify` (5.7K installs)

**Ubicación:** `.agents\skills\graphify\`

### Uso

```bash
# Full pipeline
graphify . --code-only --html

# Query el grafo existente
graphify query "question"

# Update incremental
graphify . --code-only --update
```

### Archivos generados

- `graphify-out/graph.html` — Grafo interactivo
- `graphify-out/graph.json` — Datos crudos
- `graphify-out/GRAPH_REPORT.md` — Reporte de comunidades

### Requisitos

- `pip install graphifyy`
- Python 3.10+
- Para extracción semántica (docs/papers): `GEMINI_API_KEY` o similar

### Nota

El proyecto usa `--code-only` para evitar necesidad de API keys. Los archivos `.md` no se indexan en el grafo.
