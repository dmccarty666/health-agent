You are verifying the Hermes memory core library for David McCarty. Task: verify all files in ~/.hermes/hermes-agent/hermes_memory_core/ are complete and working.

Files to verify (use wc -l and python3 import checks):
1. hermes_memory_core/store/sqlite.py - should be ~1715 lines, has MemoryStore, MemoryDB, get_memory_store(), fact_links table, entity_relations table
2. hermes_memory_core/dream/worker.py - should be ~1787 lines, has DreamWorker, _extract_facts, _build_graph
3. hermes_memory_core/dream/entity.py - should be ~171 lines, has extract_entities()
4. hermes_memory_core/dream/rel_extract.py - should be ~173 lines, has RelationExtractor
5. hermes_memory_core/dream/temporal.py - should be ~173 lines
6. hermes_memory_core/health.py - should be ~389 lines
7. hermes_memory_core/metrics.py - should be ~168 lines

Commands:
wc -l ~/.hermes/hermes-agent/hermes_memory_core/store/sqlite.py
wc -l ~/.hermes/hermes-agent/hermes_memory_core/dream/worker.py
python3 -c "import sys; sys.path.insert(0, '/home/dmccarty/.hermes/hermes-agent'); from hermes_memory_core.store.sqlite import MemoryStore, MemoryDB; print('MemoryStore/MemoryDB OK')"
python3 -c "import sys; sys.path.insert(0, '/home/dmccarty/.hermes/hermes-agent'); from hermes_memory_core.dream.worker import DreamWorker; print('DreamWorker OK')"
python3 -c "import sys; sys.path.insert(0, '/home/dmccarty/.hermes/hermes-agent'); from hermes_memory_core.dream.entity import extract_entities; print('extract_entities OK')"
python3 -c "import sys; sys.path.insert(0, '/home/dmccarty/.hermes/hermes-agent'); from hermes_memory_core.dream.rel_extract import RelationExtractor; print('RelationExtractor OK')"

Report status of each file (line count match, import success/failure) in result.json.
