import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

@Directive({
  selector: '[appDraggable]',
  standalone: true,
})
export class DraggableDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  private unlisteners: (() => void)[] = [];

  ngOnInit(): void {
    this.unlisteners.push(
      this.listen(this.el.nativeElement, 'pointerdown', (event: PointerEvent) =>
        this.onPointerDown(event),
      ),
    );
  }

  ngOnDestroy(): void {
    this.unlisteners.forEach((unlisten) => unlisten());
  }

  private listen(
    target: HTMLElement | Document,
    eventName: string,
    handler: (event: PointerEvent) => void,
  ): () => void {
    const listener = (event: Event) => handler(event as PointerEvent);
    target.addEventListener(eventName, listener);
    return () => target.removeEventListener(eventName, listener);
  }

  private onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target || !target.closest('.report-popup-header')) {
      return;
    }

    const popup = this.el.nativeElement;
    const overlay = popup.parentElement;
    if (!overlay) {
      return;
    }

    if (getComputedStyle(popup).position !== 'absolute') {
      const rect = popup.getBoundingClientRect();
      popup.style.position = 'absolute';
      popup.style.margin = '0';
      popup.style.top = `${rect.top}px`;
      popup.style.left = `${rect.left}px`;
    }

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = popup.offsetLeft;
    const startTop = popup.offsetTop;

    const onMove = (moveEvent: PointerEvent) => {
      popup.style.left = `${startLeft + moveEvent.clientX - startX}px`;
      popup.style.top = `${startTop + moveEvent.clientY - startY}px`;
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    event.preventDefault();
  }
}
