import { useCallback, useEffect, useRef, useState } from 'react'
import type { CVInput } from '../types'
import { extractPdf, isPdfFile } from '../utils/pdfExtractor'

export type PdfParseStatus = 'pending' | 'processing' | 'success' | 'error'

/** Per-file state within the extraction list. */
export interface ParsedPdf {
  id: string
  fileName: string
  fileSize: number
  status: PdfParseStatus
  /** Extracted text; empty until `status === 'success'`. */
  text: string
  pageCount: number | null
  /** Error message when `status === 'error'`. */
  error: string | null
}

export interface UsePdfParserResult {
  /** Current list of files and their extraction state. */
  items: ParsedPdf[]
  /** True while a batch is being extracted. */
  isLoading: boolean
  /** Batch-level error (e.g. invalid file type); per-file errors live in `items`. */
  error: string | null
  /** Extracts a batch of PDF files. Resolves with the resulting list. */
  parseFiles: (files: File[] | FileList) => Promise<ParsedPdf[]>
  /** Removes one file from the list (allowed during extraction). */
  removeItem: (id: string) => void
  /** Clears everything and cancels any in-flight extraction. */
  reset: () => void
}

/** Maps successfully extracted files to the payload expected by the Edge Function. */
export function toCVInputs(items: ParsedPdf[]): CVInput[] {
  return items
    .filter((item) => item.status === 'success')
    .map((item) => ({ id: item.id, text: item.text, fileName: item.fileName }))
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Manages the state (loading / error / results) of extracting a list of PDF files.
 *
 * - Files are processed sequentially to keep memory usage predictable.
 * - Each call to `parseFiles` starts a new "run": a newer run (or `reset()`)
 *   invalidates the previous one, so state always reflects the latest request.
 * - Removing an item while the batch runs is safe: its update is skipped.
 */
export function usePdfParser(): UsePdfParserResult {
  const [items, setItems] = useState<ParsedPdf[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Mirrors `items` so async loops never read a stale snapshot. */
  const itemsRef = useRef<ParsedPdf[]>([])
  /** Identifies the active run; bumped on new runs, reset and unmount. */
  const runIdRef = useRef(0)

  // Invalidate in-flight work when the consuming component unmounts.
  useEffect(() => {
    return () => {
      runIdRef.current++
    }
  }, [])

  const commit = useCallback((next: ParsedPdf[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])

  const patchItem = useCallback(
    (id: string, patch: Partial<ParsedPdf>) => {
      const index = itemsRef.current.findIndex((item) => item.id === id)
      if (index === -1) return // item was removed while extraction was running
      const next = [...itemsRef.current]
      next[index] = { ...next[index], ...patch }
      commit(next)
    },
    [commit],
  )

  const parseFiles = useCallback(
    async (files: File[] | FileList): Promise<ParsedPdf[]> => {
      const list = Array.from(files)
      if (list.length === 0) return itemsRef.current

      const invalid = list.find((file) => !isPdfFile(file))
      if (invalid) {
        setError(`"${invalid.name}" no es un archivo PDF válido.`)
        return itemsRef.current
      }

      const runId = ++runIdRef.current
      setError(null)
      setIsLoading(true)

      const newItems: ParsedPdf[] = list.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        fileSize: file.size,
        status: 'pending',
        text: '',
        pageCount: null,
        error: null,
      }))
      const batch = list.map((file, index) => ({ id: newItems[index].id, file }))
      commit(newItems)

      try {
        for (const { id, file } of batch) {
          if (runIdRef.current !== runId) break // superseded by a newer run or reset()
          patchItem(id, { status: 'processing' })

          try {
            const result = await extractPdf(file)
            patchItem(id, {
              status: 'success',
              text: result.text,
              pageCount: result.pageCount,
            })
          } catch (err) {
            patchItem(id, { status: 'error', error: toMessage(err) })
          }
        }
        return itemsRef.current
      } finally {
        if (runIdRef.current === runId) setIsLoading(false)
      }
    },
    [commit, patchItem],
  )

  const removeItem = useCallback(
    (id: string) => {
      commit(itemsRef.current.filter((item) => item.id !== id))
    },
    [commit],
  )

  const reset = useCallback(() => {
    runIdRef.current++ // cancels any in-flight run
    commit([])
    setError(null)
    setIsLoading(false)
  }, [commit])

  return { items, isLoading, error, parseFiles, removeItem, reset }
}
