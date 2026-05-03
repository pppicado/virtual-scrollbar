import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VirtualScrollbarComponent } from './virtual-scrollbar.component';

describe('VirtualScrollbarComponent', () => {
    let component: VirtualScrollbarComponent;
    let fixture: ComponentFixture<VirtualScrollbarComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [VirtualScrollbarComponent]
        });
        fixture = TestBed.createComponent(VirtualScrollbarComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
