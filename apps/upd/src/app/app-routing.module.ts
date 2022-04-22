import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AppComponent } from './app.component';

const routes: Routes = [
  {
    path: 'overview',
    loadChildren: () =>
      import('@cra-arc/upd/views/overview').then(
        (module) => module.OverviewModule
      ),
  },
  {
    path: 'pages',
    loadChildren: () =>
      import('@cra-arc/upd/views/pages').then((module) => module.PagesModule),
  },
  {
    path: 'tasks',
    loadChildren: () =>
      import('@cra-arc/upd/views/tasks').then((module) => module.TasksModule),
  },
  {
    path: 'projects',
    loadChildren: () =>
      import('@cra-arc/upd/views/projects').then(
        (module) => module.ProjectsModule
      ),
  },
  { path: '**', redirectTo: 'overview' },
];

@NgModule({
  imports: [
    RouterModule.forRoot([
      {
        path: ':lang',
        children: routes,
      },
    ]),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
