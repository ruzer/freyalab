import {vi} from 'vitest'
// Frontera del empaquetador: Vitest usa los mismos bytes de fuente. La presencia
// y lectura real dentro de ASAR se comprueban por separado en el paquete.
vi.mock('../src/main/csl/apa.csl?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/csl/apa.csl',import.meta.url))}))
vi.mock('../src/main/csl/ieee.csl?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/csl/ieee.csl',import.meta.url))}))
vi.mock('../src/main/csl/nlm-citation-sequence.csl?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/csl/nlm-citation-sequence.csl',import.meta.url))}))
vi.mock('../src/main/csl/chicago-author-date.csl?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/csl/chicago-author-date.csl',import.meta.url))}))
vi.mock('../src/main/csl/modern-language-association.csl?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/csl/modern-language-association.csl',import.meta.url))}))
vi.mock('../src/main/docx-reference.docx?asset',async()=>({default:(await import('node:url')).fileURLToPath(new URL('../src/main/docx-reference.docx',import.meta.url))}))
