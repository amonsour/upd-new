import { Component, OnInit } from '@angular/core';
import { PagesDetailsFacade } from './+state/pages-details.facade';

import { ColumnConfig } from '@dua-upd/upd-components';
import { I18nFacade } from '@dua-upd/upd/state';
import { filter } from 'rxjs';
import { EN_CA } from '@dua-upd/upd/i18n';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

@Component({
  selector: 'upd-page-details',
  templateUrl: './pages-details.component.html',
  styleUrls: ['./pages-details.component.css'],
})
export class PagesDetailsComponent implements OnInit {
  title$ = this.pageDetailsService.pageTitle$;
  url$ = this.pageDetailsService.pageUrl$;
  pageStatus$ = this.pageDetailsService.pageStatus$;
  loading$ = this.pageDetailsService.loading$;
  currentLang$ = this.i18n.currentLang$;
  showUrl = true;
  showAlert = false;

  langLink = 'en';
  navTabs: { href: string; title: string }[] = [];
  projects$ = this.pageDetailsService.projects$;
  altPageId$ = this.pageDetailsService.altPageId$;
  projectsCol: ColumnConfig = { field: '', header: '' };

  currentUrl = '';
  altPageId = '';

  constructor(
    private route: ActivatedRoute,
    private pageDetailsService: PagesDetailsFacade,
    private i18n: I18nFacade,
    private router: Router
  ) {
    this.currentUrl = this.router.url.substring(
      this.router.url.lastIndexOf('/') + 1
    );

    router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl = this.router.url.substring(
          this.router.url.lastIndexOf('/') + 1
        );
      });
  }

  ngOnInit(): void {
    this.pageDetailsService.init();

    combineLatest([
      this.currentLang$,
      this.altPageId$
    ]).subscribe(([lang, altPageId]) => {
      this.langLink = lang === EN_CA ? 'en' : 'fr';

      this.altPageId = `/${this.langLink}/pages/${altPageId}/summary`

      this.navTabs = [
        {
          href: 'summary',
          title: this.i18n.service.translate('tab-summary', lang),
        },
        {
          href: 'webtraffic',
          title: this.i18n.service.translate('tab-webtraffic', lang),
        },
        {
          href: 'searchanalytics',
          title: this.i18n.service.translate('tab-searchanalytics', lang),
        },
        {
          href: 'pagefeedback',
          title: this.i18n.service.translate('tab-pagefeedback', lang),
        },
        {
          href: 'readability',
          title: this.i18n.service.translate('tab-readability', lang),
        },
        // { href: 'details', title: this.i18n.service.translate('tab-details', lang) },
      ];

      this.projectsCol = {
        field: 'title',
        header: 'project',
        type: 'link',
        typeParams: {
          preLink: '/' + this.langLink + '/projects',
          link: 'id',
        },
      } as ColumnConfig;
    });
  }

  toggleUrl() {
    this.showUrl = !this.showUrl;
  }

  toggleAlert() {
    this.showAlert = !this.showAlert;
  }
}
