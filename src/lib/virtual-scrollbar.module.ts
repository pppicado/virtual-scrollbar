import { NgModule } from '@angular/core';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { VirtualScrollbarComponent } from './virtual-scrollbar.component';

@NgModule({
  declarations: [
    VirtualScrollbarComponent
  ],
  imports: [
    CommonModule,
    DragDropModule
  ],
  exports: [
    VirtualScrollbarComponent
  ]
})
export class VirtualScrollbarModule { }
