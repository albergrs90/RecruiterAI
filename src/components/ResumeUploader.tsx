import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { CircleAlert, FileText, Upload, X } from 'lucide-react'
import { isPdfFile } from '../utils/pdfExtractor'

export interface ResumeUploaderProps {
  /** Selected files (controlled by the parent). */
  files: File[]
  /** Called with the updated list after adding/removing files. */
  onFilesChange: (files: File[]) => void
  /** Maximum number of files. Defaults to 5. */
  maxFiles?: number
  /** Disables selection and drag & drop (e.g. while analyzing). */
  disabled?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ResumeUploader({
  files,
  onFilesChange,
  maxFiles = 5,
  disabled = false,
}: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  /** Depth counter: dragleave fires when entering/leaving child elements. */
  const dragDepth = useRef(0)

  // Auto-dismiss validation messages.
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  const addFiles = (incoming: FileList | File[]) => {
    if (disabled) return

    const list = Array.from(incoming)
    if (list.length === 0) return

    const messages: string[] = []
    const pdfs = list.filter(isPdfFile)
    if (pdfs.length < list.length) {
      messages.push('Solo se admiten archivos PDF.')
    }

    const slots = Math.max(0, maxFiles - files.length)
    const accepted = pdfs.slice(0, slots)
    const ignored = pdfs.length - accepted.length
    if (ignored > 0) {
      messages.push(`Máximo ${maxFiles} archivos: se ignoraron ${ignored}.`)
    }

    setError(messages.length > 0 ? messages.join(' ') : null)

    if (accepted.length > 0) {
      onFilesChange([...files, ...accepted])
    }
  }

  const removeAt = (index: number) => {
    if (disabled) return
    onFilesChange(files.filter((_, i) => i !== index))
  }

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) return
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files)
    // Allow selecting the same file again after removing it.
    event.target.value = ''
  }

  const isFull = files.length >= maxFiles

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400"
          >
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base leading-tight font-semibold tracking-tight text-slate-900 sm:text-lg dark:text-slate-50">
              Currículums
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500 sm:text-sm dark:text-slate-400">
              Arrastra o selecciona hasta {maxFiles} archivos PDF.
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {files.length}/{maxFiles}
        </span>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label="Zona de carga: arrastra aquí tus currículums en PDF o haz clic para seleccionarlos"
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 sm:py-10 ${
          disabled
            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-800/50'
            : isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10'
              : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/10'
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-11 w-11 place-items-center rounded-full transition ${
            isDragging && !disabled
              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300'
              : 'bg-white text-indigo-500 shadow-sm dark:bg-slate-800 dark:text-indigo-400'
          }`}
        >
          <Upload className="h-5 w-5" />
        </span>

        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {isDragging ? 'Suelta aquí tus currículums' : 'Arrastra tus CV aquí'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          o haz clic para seleccionarlos · solo PDF
        </p>

        {isFull && !disabled && (
          <p className="mt-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            Límite de {maxFiles} archivos alcanzado
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
      />

      {error && (
        <p
          role="alert"
          className="mt-3 inline-flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <CircleAlert aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {/* Selected files */}
      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Archivos seleccionados
          </h3>
          <ul className="mt-2 space-y-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:border-slate-700"
              >
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
                >
                  <FileText className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium text-slate-800 dark:text-slate-100"
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  disabled={disabled}
                  aria-label={`Eliminar ${file.name}`}
                  className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default ResumeUploader
