import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Component, ViewChild, ElementRef } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { VirtualScrollbarComponent } from './virtual-scrollbar.component';

@Component({
    selector: 'lib-test-host',
    template: `
        <div #host style="height: 200px; width: 200px; overflow: hidden;">
            <lib-virtual-scrollbar>
                <div style="height: 800px; width: 800px;">tall content</div>
            </lib-virtual-scrollbar>
        </div>
    `,
    standalone: false
})
class HostComponent {
    @ViewChild('host') host!: ElementRef<HTMLDivElement>;
}

describe('VirtualScrollbarComponent', () => {
    let component: VirtualScrollbarComponent;
    let fixture: ComponentFixture<VirtualScrollbarComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [DragDropModule],
            declarations: [VirtualScrollbarComponent]
        });
        fixture = TestBed.createComponent(VirtualScrollbarComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should accept scrollIcon input', () => {
        component.scrollIcon = 'assets/icon.png';
        fixture.detectChanges();
        expect(component.scrollIcon).toBe('assets/icon.png');
    });

    it('should default scrollThumbSize to "2vw"', () => {
        fixture.detectChanges();
        expect(component.scrollThumbSize).toBe('2vw');
    });

    it('should expose thumbSizeStyle as the input', () => {
        component.scrollThumbSize = '12px';
        expect((component as any).thumbSizeStyle).toBe('12px');
    });

    describe('parseThumbSize()', () => {
        beforeEach(() => fixture.detectChanges());

        it('parses px to raw value', () => {
            component.scrollThumbSize = '15px';
            expect((component as any).parseThumbSize()).toBe(15);
        });

        it('parses vw against window.innerWidth', () => {
            component.scrollThumbSize = '50vw';
            spyOnProperty(window, 'innerWidth', 'get').and.returnValue(1000);
            expect((component as any).parseThumbSize()).toBe(500);
        });

        it('parses vh against window.innerHeight', () => {
            component.scrollThumbSize = '25vh';
            spyOnProperty(window, 'innerHeight', 'get').and.returnValue(800);
            expect((component as any).parseThumbSize()).toBe(200);
        });

        it('parses % against container clientHeight', () => {
            component.scrollThumbSize = '50%';
            (component as any).scrollContainer = {
                nativeElement: { clientHeight: 400, clientWidth: 400 }
            } as ElementRef<HTMLDivElement>;
            expect((component as any).parseThumbSize()).toBe(200);
        });

        it('returns 20 for unparseable input', () => {
            component.scrollThumbSize = 'not-a-size';
            expect((component as any).parseThumbSize()).toBe(20);
        });

        it('returns 20 for empty input', () => {
            component.scrollThumbSize = '';
            expect((component as any).parseThumbSize()).toBe(20);
        });
    });

    describe('onContentScroll()', () => {
        beforeEach(fakeAsync(() => {
            fixture.detectChanges();
            tick();
        }));

        it('hides vertical scrollbar when content fits', () => {
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 200, clientHeight: 400,
                    scrollWidth: 200, clientWidth: 400,
                    scrollTop: 0, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            (component as any).onContentScroll();
            expect(component.showVertical).toBeFalse();
            expect(component.showHorizontal).toBeFalse();
        });

        it('shows vertical scrollbar when content overflows', () => {
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 800, clientHeight: 200,
                    scrollWidth: 200, clientWidth: 400,
                    scrollTop: 0, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            (component as any).onContentScroll();
            expect(component.showVertical).toBeTrue();
        });

        it('does not produce NaN when maxScrollTop is 0', () => {
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 200, clientHeight: 200,
                    scrollWidth: 200, clientWidth: 200,
                    scrollTop: 0, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            expect(() => (component as any).onContentScroll()).not.toThrow();
            expect(component.showVertical).toBeFalse();
            expect(component.verticalThumbPos.y).not.toBeNaN();
        });

        it('clamps thumb position to valid range when scrolled to bottom', () => {
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 800, clientHeight: 200,
                    scrollWidth: 200, clientWidth: 400,
                    scrollTop: 600, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            component.scrollThumbSize = '20px';
            (component as any).onContentScroll();
            const maxThumbTop = 200 - 20;
            expect(component.verticalThumbPos.y).toBe(maxThumbTop);
        });

        it('does not update thumb position while dragging vertically', () => {
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 800, clientHeight: 200,
                    scrollWidth: 200, clientWidth: 400,
                    scrollTop: 0, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            component.isDraggingVertical = true;
            component.verticalThumbPos = { x: 0, y: 999 };
            (component as any).onContentScroll();
            expect(component.verticalThumbPos.y).toBe(999);
        });
    });

    describe('drag handlers', () => {
        let mockSource: any;

        beforeEach(() => {
            fixture.detectChanges();
            // Drag handlers read el = this.scrollContainer.nativeElement.
            // @ViewChild is not auto-initialized in TestBed without a
            // surrounding template, so we inject a mock.
            (component as any).scrollContainer = {
                nativeElement: {
                    scrollHeight: 1000, clientHeight: 200,
                    scrollWidth: 200, clientWidth: 200,
                    scrollTop: 0, scrollLeft: 0
                }
            } as ElementRef<HTMLDivElement>;
            mockSource = {
                getFreeDragPosition: jasmine.createSpy('getFreeDragPosition')
            };
        });

        it('onVerticalDragStart sets the drag lock', () => {
            (component as any).onVerticalDragStart({} as any);
            expect(component.isDraggingVertical).toBeTrue();
        });

        it('onVerticalDragEnd clears the drag lock', () => {
            component.isDraggingVertical = true;
            (component as any).scrollContainer = {
                nativeElement: { scrollHeight: 200, clientHeight: 200, scrollWidth: 200, clientWidth: 200, scrollTop: 0, scrollLeft: 0 }
            } as ElementRef<HTMLDivElement>;
            (component as any).onVerticalDragEnd({} as any);
            expect(component.isDraggingVertical).toBeFalse();
        });

        it('onVerticalDragMoved maps drag position to scrollTop (ratio-based)', () => {
            (component as any).scrollContainer = {
                nativeElement: { scrollHeight: 1000, clientHeight: 200, scrollWidth: 200, clientWidth: 200, scrollTop: 0, scrollLeft: 0 }
            } as ElementRef<HTMLDivElement>;
            component.scrollThumbSize = '20px';
            mockSource.getFreeDragPosition.and.returnValue({ x: 0, y: 90 });
            (component as any).onVerticalDragMoved({ source: mockSource } as any);
            const maxScrollTop = 1000 - 200;
            expect((component as any).scrollContainer.nativeElement.scrollTop).toBe(400);
        });

        it('onVerticalDragMoved does not divide by zero when maxThumbTop <= 0', () => {
            (component as any).scrollContainer = {
                nativeElement: { scrollHeight: 200, clientHeight: 200, scrollWidth: 200, clientWidth: 200, scrollTop: 0, scrollLeft: 0 }
            } as ElementRef<HTMLDivElement>;
            component.scrollThumbSize = '999px';
            mockSource.getFreeDragPosition.and.returnValue({ x: 0, y: 50 });
            expect(() => (component as any).onVerticalDragMoved({ source: mockSource } as any)).not.toThrow();
        });

        it('onHorizontalDragMoved maps drag x to scrollLeft', () => {
            (component as any).scrollContainer = {
                nativeElement: { scrollHeight: 200, clientHeight: 200, scrollWidth: 1000, clientWidth: 200, scrollTop: 0, scrollLeft: 0 }
            } as ElementRef<HTMLDivElement>;
            component.scrollThumbSize = '20px';
            mockSource.getFreeDragPosition.and.returnValue({ x: 90, y: 0 });
            (component as any).onHorizontalDragMoved({ source: mockSource } as any);
            expect((component as any).scrollContainer.nativeElement.scrollLeft).toBe(400);
        });
    });

    describe('lifecycle', () => {
        it('ngOnDestroy releases the scroll listener and ResizeObserver', () => {
            fixture.detectChanges();
            const listener = jasmine.createSpy('unlisten');
            (component as any).scrollListener = listener;
            const ro = { disconnect: jasmine.createSpy('disconnect') };
            (component as any).resizeObserver = ro;
            component.ngOnDestroy();
            expect(listener).toHaveBeenCalled();
            expect(ro.disconnect).toHaveBeenCalled();
        });

        it('ngOnDestroy does not throw when called without init', () => {
            (component as any).scrollListener = null;
            (component as any).resizeObserver = null;
            expect(() => component.ngOnDestroy()).not.toThrow();
        });

        it('ngAfterViewInit schedules an initial scroll calculation via setTimeout', fakeAsync(() => {
            const onContentScroll = spyOn(component as any, 'onContentScroll');
            component.ngAfterViewInit();
            tick();
            expect(onContentScroll).toHaveBeenCalled();
        }));
    });
});
