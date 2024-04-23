import { Component, OnInit } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  pdfDoc: any;
  pageNum = 1;
  pageRendering = false;
  pageNumPending: any = null;
  scale = 1.5;
  canvas: any;
  ctx: any;
  thumbnailOrder: number[] = [];

  ngOnInit() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/pdf.worker.js';
    this.canvas = document.getElementById('pdf-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.loadPDF();
  }

  async loadPDF() {
    const url = 'assets/data.pdf';
    this.pdfDoc = await pdfjsLib.getDocument(url).promise;
    this.renderPage(this.pageNum);
    this.generateThumbnails();
    document.getElementById('pdf-loader')!.style.display = 'none';
    document.getElementById('pdf-contents')!.style.display = 'block';
  }

  renderPage(num: number) {
    this.pageRendering = true;
    this.pdfDoc.getPage(num).then((page: any) => {
      const viewport = page.getViewport({ scale: this.scale });
      this.canvas.height = viewport.height;
      this.canvas.width = viewport.width;

      const renderContext = {
        canvasContext: this.ctx,
        viewport: viewport
      };
      const renderTask = page.render(renderContext);

      renderTask.promise.then(() => {
        this.pageRendering = false;
        if (this.pageNumPending !== null) {
          this.renderPage(this.pageNumPending);
          this.pageNumPending = null;
        }
      });
    });
  }

  queueRenderPage(num: number) {
    if (this.pageRendering) {
      this.pageNumPending = num;
    } else {
      this.renderPage(num);
    }
  }

  onPrevPage() {
    if (this.pageNum <= 1) {
      return;
    }
    this.pageNum--;
    this.queueRenderPage(this.pageNum);
  }

  onNextPage() {
    if (this.pageNum >= this.pdfDoc.numPages) {
      return;
    }
    this.pageNum++;
    this.queueRenderPage(this.pageNum);
  }

  onZoomIn() {
    this.scale += 0.5;
    this.queueRenderPage(this.pageNum);
  }

  onZoomOut() {
    this.scale -= 0.5;
    this.queueRenderPage(this.pageNum);
  }

  generateThumbnails() {
    const thumbnailPanel = document.getElementById('thumbnail-panel');
    for (let i = 1; i <= this.pdfDoc.numPages; i++) {
      this.pdfDoc.getPage(i).then((page: any) => {
        const viewport = page.getViewport({ scale: 0.2 });
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        thumbnailCanvas.height = viewport.height;
        thumbnailCanvas.width = viewport.width;
        const renderContext = {
          canvasContext: thumbnailCtx,
          viewport: viewport
        };
        page.render(renderContext);

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'thumbnail-container';
        thumbnailContainer.appendChild(thumbnailCanvas);
        thumbnailContainer.addEventListener('click', () => {
          this.pageNum = i;
          this.queueRenderPage(this.pageNum);
        });
        thumbnailContainer.setAttribute('draggable', 'true');
        thumbnailContainer.setAttribute('data-page-number', i.toString());
        thumbnailContainer.addEventListener('dragstart', this.handleDragStart.bind(this));
        thumbnailContainer.addEventListener('dragover', this.handleDragOver.bind(this));
        thumbnailContainer.addEventListener('drop', this.handleDrop.bind(this));
        thumbnailContainer.addEventListener('dragenter', this.handleDragEnter.bind(this));
        thumbnailContainer.addEventListener('dragleave', this.handleDragLeave.bind(this));

        thumbnailPanel!.appendChild(thumbnailContainer);
        this.thumbnailOrder.push(i);
      });
    }
  }

  handleDragStart(e: any) {
    e.dataTransfer.setData('text/plain', e.target.getAttribute('data-page-number'));
  }

  handleDragOver(e: any) {
    e.preventDefault();
  }

  handleDrop(e: any) {
    e.preventDefault();
    const sourcePageNum = parseInt(e.dataTransfer.getData('text'), 10);
    const targetPageNum = parseInt(e.target.getAttribute('data-page-number'), 10);

    if (sourcePageNum !== targetPageNum) {
      const sourceIndex = this.thumbnailOrder.indexOf(sourcePageNum);
      const targetIndex = this.thumbnailOrder.indexOf(targetPageNum);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        this.thumbnailOrder.splice(sourceIndex, 1);
        this.thumbnailOrder.splice(targetIndex, 0, sourcePageNum);

        const thumbnailPanel = document.getElementById('thumbnail-panel');
        const thumbnails = thumbnailPanel!.getElementsByClassName('thumbnail-container');
        const sourceThumbnail = thumbnails[sourceIndex];
        const targetThumbnail = thumbnails[targetIndex];

        if (sourceIndex < targetIndex) {
          thumbnailPanel!.insertBefore(sourceThumbnail, targetThumbnail.nextSibling);
        } else {
          thumbnailPanel!.insertBefore(sourceThumbnail, targetThumbnail);
        }
      }
    }
  }

  handleDragEnter(e: any) {
    e.preventDefault();
    e.target.style.opacity = '0.5';
  }

  handleDragLeave(e: any) {
    e.preventDefault();
    e.target.style.opacity = '1';
  }

  async savePDF() {
    const url = 'assets/data.pdf';
    const pdfBytes = await fetch(url).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const newPdfDoc = await PDFDocument.create();

    for (const pageNum of this.thumbnailOrder) {
      const [page] = await newPdfDoc.copyPages(pdfDoc, [pageNum - 1]);
      newPdfDoc.addPage(page);
    }

    const pdfFile = await newPdfDoc.save();
    const blob = new Blob([pdfFile], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'reordered.pdf';
    link.click();
  }
}