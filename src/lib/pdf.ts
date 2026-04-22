import * as pdfjsLib from 'pdfjs-dist/build/pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import { PDFDocument } from 'pdf-lib'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function loadPdfPageCount(pdfBytes: ArrayBuffer): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes })
  const doc = await loadingTask.promise
  return doc.numPages
}

export async function renderPdfPageToCanvas(opts: {
  pdfBytes: ArrayBuffer
  pageNumber1: number
  maxWidth: number
}): Promise<HTMLCanvasElement> {
  const loadingTask = pdfjsLib.getDocument({ data: opts.pdfBytes })
  const doc = await loadingTask.promise
  const page = await doc.getPage(opts.pageNumber1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = Math.min(1, opts.maxWidth / viewport.width)
  const v = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 Canvas 上下文')
  canvas.width = Math.floor(v.width)
  canvas.height = Math.floor(v.height)

  await page.render({ canvasContext: ctx, viewport: v }).promise
  return canvas
}

export async function splitPdfByGroups(opts: { pdfBytes: ArrayBuffer; groups: number[][] }): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(opts.pdfBytes)
  const out: Uint8Array[] = []

  for (const g of opts.groups) {
    const dst = await PDFDocument.create()
    const copied = await dst.copyPages(src, g)
    copied.forEach(p => dst.addPage(p))
    const bytes = await dst.save()
    out.push(bytes)
  }

  return out
}
