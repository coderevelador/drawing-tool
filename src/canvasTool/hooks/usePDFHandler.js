import { useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { useCanvasStore } from '../state/canvasStore';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export const usePDFHandler = () => {
  // Zustand selectors
  const canvasEngine   = useCanvasStore(s => s.canvasEngine);
  const setPdfDoc      = useCanvasStore(s => s.setPdfDoc);
  const setTotalPages  = useCanvasStore(s => s.setTotalPages);
  const setCurrentPage = useCanvasStore(s => s.setCurrentPage);
  const setPdfLoading  = useCanvasStore(s => s.setPdfLoading);

  // Render a given page number onto the canvas
  const renderPage = async (pageNum, pdf = useCanvasStore.getState().pdfDoc) => {
    const page     = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 });
    const ctx      = canvasEngine.getContext();
    canvasEngine.resize(viewport.width, viewport.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
  };

  // Handle user file‑select, load PDF, render page 1
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !canvasEngine) return;

    setPdfLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf         = await loadingTask.promise;

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      await renderPage(1, pdf);
      setCurrentPage(1);
    } catch (err) {
      console.error('PDF load error:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [
    canvasEngine,
    setPdfDoc,
    setTotalPages,
    setCurrentPage,
    setPdfLoading,
  ]);

  // Move to prev/next page
  const changePage = useCallback(async (dir) => {
    const { currentPage, totalPages, pdfDoc } = useCanvasStore.getState();
    let newPage = dir === 'prev' ? currentPage - 1 : currentPage + 1;
    if (newPage < 1 || newPage > totalPages) return;

    setPdfLoading(true);
    try {
      await renderPage(newPage, pdfDoc);
      setCurrentPage(newPage);
    } catch (err) {
      console.error('PDF render error:', err);
    } finally {
      setPdfLoading(false);
    }
  }, [
    setCurrentPage,
    setPdfLoading,
  ]);

  return { handleFileUpload, changePage };
};
