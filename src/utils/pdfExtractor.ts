import * as pdfjsLib from 'pdfjs-dist'
// Vite resolves this import to a hashed public URL for the worker asset.
// Setting it as `workerSrc` makes PDF.js load a real Web Worker instead of
// falling back to the "fake worker" (main thread) or failing under Vite/React.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// Configure the worker once, at module load, before any getDocument() call.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Text of a single PDF page, 1-indexed. */
export interface PdfPage {
  pageNumber: number
  text: string
}

/** Full extraction result of one PDF file. */
export interface PdfExtractionResult {
  fileName: string
  pageCount: number
  pages: PdfPage[]
  /** Text of every page joined with a blank line. */
  text: string
}

/**
 * Structural shape of the items we care about from getTextContent().
 * PDF.js returns `TextItem | TextMarkedContent`; only TextItem carries `str`.
 */
type PdfContentItem =
  | { str: string; transform: number[]; width: number; hasEOL: boolean }
  | { type: string }

/** Vertical distance (PDF units) above which two runs belong to different lines. */
const LINE_TOLERANCE = 2
/** Horizontal gap (PDF units) that implies a missing space between two runs. */
const SPACE_GAP = 1

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Rebuilds plain text from a page's content runs.
 *
 * Uses the run coordinates (transform) instead of `hasEOL` alone:
 * - a change in Y starts a new line;
 * - a horizontal gap between runs inserts a missing space;
 * - empty lines are collapsed to at most one blank line.
 */
function itemsToText(items: PdfContentItem[]): string {
  let text = ''
  let prevY: number | null = null
  let prevRight: number | null = null

  for (const item of items) {
    if (!('str' in item)) continue // skip marked-content markers

    const x = item.transform[4] ?? 0
    const y = item.transform[5] ?? 0

    if (prevY !== null && Math.abs(y - prevY) > LINE_TOLERANCE) {
      text += '\n'
    } else if (
      prevRight !== null &&
      x > prevRight + SPACE_GAP &&
      text.length > 0 &&
      !/\s$/.test(text) &&
      item.str.length > 0 &&
      !/^\s/.test(item.str)
    ) {
      text += ' '
    }

    text += item.str
    prevY = y
    prevRight = x + item.width
  }

  // Trim each line and collapse consecutive blank lines.
  const lines: string[] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' && (lines.length === 0 || lines[lines.length - 1] === '')) continue
    lines.push(line)
  }
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  return lines.join('\n')
}

/**
 * Extracts the plain text of every page of a PDF file, page by page.
 * Throws a descriptive error for non-PDF, empty, encrypted or unreadable files.
 */
export async function extractPdfPages(file: File): Promise<PdfPage[]> {
  if (!isPdfFile(file)) {
    throw new Error(`"${file.name}" no es un archivo PDF válido.`)
  }
  if (file.size === 0) {
    throw new Error(`El archivo "${file.name}" está vacío.`)
  }

  const data = await file.arrayBuffer()
  const task = pdfjsLib.getDocument({ data })

  try {
    const doc = await task.promise
    const pages: PdfPage[] = []

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      pages.push({ pageNumber, text: itemsToText(content.items) })
      page.cleanup()
    }

    return pages
  } catch (error) {
    const message = toMessage(error)
    if (/password/i.test(message)) {
      throw new Error(`El PDF "${file.name}" está protegido con contraseña.`)
    }
    throw new Error(`No se pudo leer "${file.name}": ${message}`)
  } finally {
    // Releases the worker and the transferred ArrayBuffer.
    await task.destroy()
  }
}

/**
 * Extracts all text of a PDF file. Throws if the document has no
 * selectable text (e.g. a scanned/image-only PDF).
 */
export async function extractPdf(file: File): Promise<PdfExtractionResult> {
  const pages = await extractPdfPages(file)
  const pageTexts = pages.filter((page) => page.text.length > 0)

  if (pageTexts.length === 0) {
    throw new Error(
      `No se pudo extraer texto de "${file.name}". Probablemente es un PDF escaneado (solo imágenes).`,
    )
  }

  return {
    fileName: file.name,
    pageCount: pages.length,
    pages,
    text: pageTexts.map((page) => page.text).join('\n\n'),
  }
}

/** Convenience wrapper: returns only the full plain text of the PDF. */
export async function extractPdfText(file: File): Promise<string> {
  return (await extractPdf(file)).text
}
