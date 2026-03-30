export interface ModalButton {
  label: string;
  value: string;
  primary?: boolean;
  disabled?: boolean;
}

export interface ModalConfig {
  title: string;
  body: string | HTMLElement;
  buttons: ModalButton[];
  closable?: boolean;
}

export class ActionModal {
  private overlay: HTMLDivElement;
  private panel: HTMLDivElement;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'action-modal-overlay';

    this.panel = document.createElement('div');
    this.panel.className = 'action-modal';
    this.overlay.appendChild(this.panel);
  }

  show(config: ModalConfig): Promise<string> {
    return new Promise(resolve => {
      this.panel.innerHTML = '';

      const header = document.createElement('div');
      header.className = 'action-modal-header';
      header.textContent = config.title;
      this.panel.appendChild(header);

      const body = document.createElement('div');
      body.className = 'action-modal-body';
      if (typeof config.body === 'string') {
        body.innerHTML = config.body;
      } else {
        body.appendChild(config.body);
      }
      this.panel.appendChild(body);

      const footer = document.createElement('div');
      footer.className = 'action-modal-footer';

      for (const btn of config.buttons) {
        const el = document.createElement('button');
        el.className = btn.primary ? 'btn btn-primary' : 'btn btn-secondary';
        el.style.padding = '10px 28px';
        el.style.fontSize = '0.9rem';
        el.textContent = btn.label;
        el.disabled = !!btn.disabled;
        el.addEventListener('click', () => {
          this.hide();
          resolve(btn.value);
        });
        footer.appendChild(el);
      }
      this.panel.appendChild(footer);

      if (config.closable !== false) {
        this.overlay.addEventListener('click', (e) => {
          if (e.target === this.overlay) {
            this.hide();
            resolve('cancel');
          }
        }, { once: true });
      }

      document.body.appendChild(this.overlay);
      requestAnimationFrame(() => this.overlay.classList.add('visible'));
    });
  }

  hide() {
    this.overlay.classList.remove('visible');
    setTimeout(() => this.overlay.remove(), 200);
  }

  updateBody(content: string | HTMLElement) {
    const body = this.panel.querySelector('.action-modal-body');
    if (!body) return;
    body.innerHTML = '';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else {
      body.appendChild(content);
    }
  }
}
