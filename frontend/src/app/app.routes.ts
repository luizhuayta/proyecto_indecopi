import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { adminGuard, seccionGuard } from './core/role.guard';
import { dirtyGuard } from './core/dirty.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./public/portal-publico').then((m) => m.PortalPublico),
  },
  {
    path: 'buscar',
    loadComponent: () => import('./public/buscar').then((m) => m.Buscar),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/admin-login').then((m) => m.AdminLogin),
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./admin/admin-shell').then((m) => m.AdminShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./admin/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'paginas',
        canActivate: [seccionGuard('paginas')],
        loadComponent: () =>
          import('./admin/admin-paginas').then((m) => m.AdminPaginas),
      },
      {
        path: 'editor/:slug',
        canActivate: [seccionGuard('paginas')],
        canDeactivate: [dirtyGuard],
        loadComponent: () =>
          import('./admin/page-editor').then((m) => m.PageEditor),
      },
      {
        path: 'identidad',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/admin-identidad').then((m) => m.AdminIdentidad),
      },
      {
        path: 'apariencia',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/admin-apariencia').then((m) => m.AdminApariencia),
      },
      {
        path: 'mensajes',
        loadComponent: () =>
          import('./admin/admin-mensajes').then((m) => m.AdminMensajes),
      },
      {
        path: 'noticias',
        loadComponent: () =>
          import('./admin/admin-noticias').then((m) => m.AdminNoticias),
      },
      {
        path: 'medios',
        loadComponent: () =>
          import('./admin/admin-medios').then((m) => m.AdminMedios),
      },
      {
        path: 'usuarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin/admin-usuarios').then((m) => m.AdminUsuarios),
      },
      {
        path: 'cuenta',
        loadComponent: () =>
          import('./admin/admin-cuenta').then((m) => m.AdminCuenta),
      },
    ],
  },
  {
    path: 'noticias',
    loadComponent: () => import('./public/noticias').then((m) => m.Noticias),
  },
  {
    path: 'noticias/:slug',
    loadComponent: () =>
      import('./public/noticia-detalle').then((m) => m.NoticiaDetalle),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./public/portal-publico').then((m) => m.PortalPublico),
  },
];
