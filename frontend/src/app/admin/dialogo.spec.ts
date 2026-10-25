// @vitest-environment jsdom
import '@angular/compiler';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DialogoService } from './dialogo.service';

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());

describe('DialogoService', () => {
  let servicio: DialogoService;

  beforeEach(() => {
    // El servicio vive en el inyector raíz: no hace falta configurar nada.
    servicio = TestBed.inject(DialogoService);
  });

  it('abre el dialogo con el titulo y el mensaje pedidos', async () => {
    const promesa = servicio.confirmar({
      titulo: 'Eliminar esta página',
      mensaje: '«Inicio» desaparecerá del sitio.',
      peligro: true,
    });

    const carta = document.querySelector('.dialogo__carta');
    expect(carta).not.toBeNull();
    expect(carta?.querySelector('.dialogo__titulo')?.textContent?.trim()).toBe('Eliminar esta página');
    expect(carta?.querySelector('.dialogo__mensaje')?.textContent?.trim()).toBe('«Inicio» desaparecerá del sitio.');
    // Es un diálogo modal, con su papel y su nombre accesibles.
    expect(carta?.getAttribute('role')).toBe('dialog');
    expect(carta?.getAttribute('aria-modal')).toBe('true');

    document.querySelectorAll<HTMLButtonElement>('.dialogo__acciones button')[1].click();
    await expect(promesa).resolves.toBe(true);
    expect(document.querySelector('.dialogo')).toBeNull();
  });

  it('devuelve false y cierra cuando se cancela', async () => {
    const promesa = servicio.confirmar({ titulo: 'Eliminar', peligro: true });

    document.querySelectorAll<HTMLButtonElement>('.dialogo__acciones button')[0].click();
    await expect(promesa).resolves.toBe(false);
    expect(document.querySelector('.dialogo')).toBeNull();
  });

  it('escape cancela el dialogo', async () => {
    const promesa = servicio.confirmar({ titulo: 'Eliminar', peligro: true });

    document
      .querySelector('.dialogo__carta')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await expect(promesa).resolves.toBe(false);
  });

  it('el boton de cancelar recibe el foco cuando la accion es destructiva', async () => {
    const promesa = servicio.confirmar({ titulo: 'Eliminar', peligro: true });
    await Promise.resolve();

    const botones = document.querySelectorAll<HTMLButtonElement>('.dialogo__acciones button');
    expect(botones[0].classList.contains('admin-btn--peligro-solido')).toBe(false);
    expect(botones[1].classList.contains('admin-btn--peligro-solido')).toBe(true);
    expect(document.activeElement).toBe(botones[0]);

    botones[0].click();
    await promesa;
  });
});
