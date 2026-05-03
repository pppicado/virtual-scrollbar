import { Component, ElementRef, Input, ViewChild, AfterViewInit, OnDestroy, Renderer2, HostListener, ChangeDetectorRef } from '@angular/core';
import { CdkDragMove, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';

@Component({
    selector: 'lib-virtual-scrollbar',
    templateUrl: './virtual-scrollbar.component.html',
    styleUrls: ['./virtual-scrollbar.component.css']
})
export class VirtualScrollbarComponent implements AfterViewInit, OnDestroy {
    @Input() scrollIcon: string = '';
    @Input() scrollThumbSize: number = 2;


    @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;

    verticalThumbPos = { x: 0, y: 0 };
    horizontalThumbPos = { x: 0, y: 0 };

    isDraggingVertical = false;
    isDraggingHorizontal = false;

    showVertical = false;
    showHorizontal = false;

    private scrollListener: Function | null = null;
    private resizeObserver: ResizeObserver | null = null;

    constructor(private renderer: Renderer2, private cdr: ChangeDetectorRef) { }

    ngAfterViewInit() {
        this.scrollListener = this.renderer.listen(this.scrollContainer.nativeElement, 'scroll', () => {
            this.onContentScroll();
        });

        // Observe size changes to update scrollbar positions
        this.resizeObserver = new ResizeObserver(() => {
            this.onContentScroll();
        });
        this.resizeObserver.observe(this.scrollContainer.nativeElement);

        // Initial calculation
        setTimeout(() => this.onContentScroll(), 0);
    }

    ngOnDestroy() {
        if (this.scrollListener) {
            this.scrollListener();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    get thumbSizeStyle() {
        return `${this.scrollThumbSize / 2}vw`;
    }

    onContentScroll() {
        const el = this.scrollContainer.nativeElement;
        const thumbSizeVw = this.scrollThumbSize;
        const thumbSizePx = (thumbSizeVw * window.innerWidth) / 100;

        // Vertical Scrollbar
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;
        this.showVertical = scrollHeight > clientHeight;

        if (!this.isDraggingVertical && this.showVertical) {
            const scrollTop = el.scrollTop;
            const maxScrollTop = scrollHeight - clientHeight;
            const maxThumbTop = clientHeight - thumbSizePx;
            const scrollRatio = scrollTop / maxScrollTop;
            this.verticalThumbPos = { x: 0, y: scrollRatio * maxThumbTop };
        }

        // Horizontal Scrollbar
        const scrollWidth = el.scrollWidth;
        const clientWidth = el.clientWidth;
        this.showHorizontal = scrollWidth > clientWidth;

        if (!this.isDraggingHorizontal && this.showHorizontal) {
            const scrollLeft = el.scrollLeft;
            const maxScrollLeft = scrollWidth - clientWidth;
            const maxThumbLeft = clientWidth - thumbSizePx;
            const scrollRatio = scrollLeft / maxScrollLeft;
            this.horizontalThumbPos = { x: scrollRatio * maxThumbLeft, y: 0 };
        }

        this.cdr.detectChanges();
    }

    onVerticalDragStart(event: CdkDragStart) {
        this.isDraggingVertical = true;
    }

    onVerticalDragEnd(event: CdkDragEnd) {
        this.isDraggingVertical = false;
        // Sync final position
        this.onContentScroll();
    }

    onVerticalDragMoved(event: CdkDragMove) {
        const el = this.scrollContainer.nativeElement;
        const thumbSizeVw = this.scrollThumbSize;
        const thumbSizePx = (thumbSizeVw * window.innerWidth) / 100;

        const currentPos = event.source.getFreeDragPosition();
        const maxThumbTop = el.clientHeight - thumbSizePx;

        if (maxThumbTop > 0) {
            const ratio = Math.max(0, Math.min(1, currentPos.y / maxThumbTop));
            const maxScrollTop = el.scrollHeight - el.clientHeight;
            el.scrollTop = ratio * maxScrollTop;
        }
    }

    onHorizontalDragStart(event: CdkDragStart) {
        this.isDraggingHorizontal = true;
    }

    onHorizontalDragEnd(event: CdkDragEnd) {
        this.isDraggingHorizontal = false;
        this.onContentScroll();
    }

    onHorizontalDragMoved(event: CdkDragMove) {
        const el = this.scrollContainer.nativeElement;
        const thumbSizeVw = this.scrollThumbSize;
        const thumbSizePx = (thumbSizeVw * window.innerWidth) / 100;

        const currentPos = event.source.getFreeDragPosition();
        const maxThumbLeft = el.clientWidth - thumbSizePx;

        if (maxThumbLeft > 0) {
            const ratio = Math.max(0, Math.min(1, currentPos.x / maxThumbLeft));
            const maxScrollLeft = el.scrollWidth - el.clientWidth;
            el.scrollLeft = ratio * maxScrollLeft;
        }
    }

}
