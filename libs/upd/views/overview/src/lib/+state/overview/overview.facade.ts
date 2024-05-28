import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import 'dayjs/locale/en-ca';
import 'dayjs/locale/fr-ca';
import { combineLatest, debounceTime, map, mergeMap, of } from 'rxjs';
import { FR_CA, type LocaleId } from '@dua-upd/upd/i18n';
import type {
  OverviewAggregatedData,
  OverviewData,
} from '@dua-upd/types-common';
import { percentChange, type UnwrapObservable } from '@dua-upd/utils-common';
import type { PickByType } from '@dua-upd/utils-common';
import * as OverviewActions from './overview.actions';
import * as OverviewSelectors from './overview.selectors';
import {
  I18nFacade,
  selectDatePeriodSelection,
  selectUrl,
} from '@dua-upd/upd/state';
import { createColConfigWithI18n } from '@dua-upd/upd/utils';
import type {
  ApexAxisChartSeries,
  ApexNonAxisChartSeries,
} from 'ng-apexcharts';
import {
  selectCallsPerVisitsChartData,
  selectComboChartData,
  selectComboChartTable,
  selectDyfNoPerVisitsSeries,
  selectVisitsByDayChartData,
  selectVisitsByDayChartTable,
} from './overview.selectors';

dayjs.extend(utc);
dayjs.extend(isSameOrBefore);
dayjs.extend(quarterOfYear);

@Injectable()
export class OverviewFacade {
  private readonly store = inject(Store);
  private readonly i18n = inject(I18nFacade);

  currentLang$ = this.i18n.currentLang$;
  loaded$ = this.store.select(OverviewSelectors.selectOverviewLoaded);
  loading$ = this.store
    .select(OverviewSelectors.selectOverviewLoading)
    .pipe(debounceTime(100));
  dateRangeSelected$ = this.store.select(selectDatePeriodSelection);
  overviewData$ = this.store.select(OverviewSelectors.selectOverviewData);

  annotationsData$ = this.store.select(
    OverviewSelectors.selectAnnotationsSeries,
  );

  currentRoute$ = this.store
    .select(selectUrl)
    .pipe(map((url) => url.replace(/\?.+$/, '')));

  visitors$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.visitors || 0),
  );
  visitorsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('visitors'),
  );

  visits$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.visits || 0),
  );
  comparisonVisits$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.comparisonDateRangeData?.visits || 0),
  );
  visitsPercentChange$ = this.overviewData$.pipe(mapToPercentChange('visits'));

  views$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.pageViews || 0),
  );

  viewsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('pageViews'),
  );

  impressions$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.impressions || 0),
  );
  impressionsPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('impressions'),
  );

  ctr$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.ctr || 0),
  );
  ctrPercentChange$ = this.overviewData$.pipe(mapToPercentChange('ctr'));

  avgRank$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.dateRangeData?.position || 0),
  );
  avgRankPercentChange$ = this.overviewData$.pipe(
    mapToPercentChange('position'),
  );

  topPagesVisited$ = this.overviewData$.pipe(
    map((data) => data?.dateRangeData?.topPagesVisited || []),
  );


  topPagesVisitedWithPercentChange$ = this.overviewData$.pipe(
    mapObjectArraysWithPercentChange('topPagesVisited', 'visits', 'url'),
    map((topPages) => topPages?.sort((a, b) => b.visits - a.visits)),
  );

  top10GSC$ = this.overviewData$.pipe(
    mapObjectArraysWithPercentChange('top10GSC', 'clicks'),
  );

  projects$ = this.overviewData$.pipe(
    map((data) => data?.projects?.projects || []),
  );

  kpiLastAvgSuccessRate$ = this.overviewData$.pipe(
    map((data) => data?.projects?.avgTestSuccessAvg || 0),
  );

  kpiTotAvgSuccessRate$ = this.overviewData$.pipe(
    map((data) => data?.projects?.avgTestSuccess || 0),
  );
  improvedKpi$ = this.overviewData$.pipe(
    map((overviewData) => overviewData?.improvedTasksKpi),
  );
 
  improvedKpiUniqueTasks$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.uniqueTasks || 0),
  );
 
  improvedKpiSuccessRate$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates || 0),
  );

  improvedKpiSuccessRateDifference$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.difference || 0),
  );

  improvedKpiSuccessRateValidation$ = this.improvedKpi$.pipe(
    map((improvedKpi) => improvedKpi?.successRates.validation || 0),
  );

  kpiTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data?.projects?.testsCompleted || 0),
  );

  uniqueTaskTestedLatestTestKpi$ = this.overviewData$.pipe(
    map((data) => data?.projects?.uniqueTaskTestedLatestTestKpi || 0),
  );

  testTypeTranslations$ = combineLatest([
    this.projects$, 
    this.currentLang$,
  ]).pipe(
    mergeMap(([projects]) => {
      const splitTestTypes = projects.flatMap(
        (project) => project.testType || [],
      );

      const testTypes = [...new Set<string>(splitTestTypes)];

      return testTypes.length > 0 ? this.i18n.service.get(testTypes) : of({});
    }),
  );

  projectsList$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
    this.testTypeTranslations$,
  ]).pipe(
    map(([data, lang, testTypeTranslations]) => {
      const uxTests = data?.uxTests || [];

      const maxUsersByTitleAndType: Record<string, Record<string, number>> = {};

      for (const { title, test_type, total_users = 0 } of uxTests) {
        if (title && test_type) {
          maxUsersByTitleAndType[title] = maxUsersByTitleAndType[title] || {};
          maxUsersByTitleAndType[title][test_type] = Math.max(
            maxUsersByTitleAndType[title][test_type] || 0,
            total_users,
          );
        }
      }

      const maxUsersByTitle = Object.keys(maxUsersByTitleAndType).reduce(
        (accumulator, title) => {
          const typeValues = maxUsersByTitleAndType[title];
          accumulator[title] = Object.values(typeValues).reduce(
            (typeSum, value) => typeSum + value,
            0,
          );
          return accumulator;
        },
        {} as Record<string, number>,
      );

      return (
        data?.projects?.projects.map((proj) => ({
          ...proj,
          title: proj.title
            ? this.i18n.service.translate(proj.title.trim(), lang)
            : '',
          testType: (proj.testType || [])
            .map(
              (testType: string) =>
                (testTypeTranslations as Record<string, string>)[testType] ||
                testType,
            )
            .sort(),
          startDate: proj.startDate || '',
          totalUsers: maxUsersByTitle[proj.title] || 0,
        })) || []
      );
    }),
  );

  calldriversTable$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRange = data?.dateRangeData?.calldriversEnquiry || [];
      const comparisonDateRange =
        data?.comparisonDateRangeData?.calldriversEnquiry || [];

      const dataEnquiryLine = dateRange.map((d) => ({
        name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
        currValue: d.sum,
        prevValue:
          comparisonDateRange.find((cd) => d.enquiry_line === cd.enquiry_line)
            ?.sum || null,
      }));

      comparisonDateRange.map((d) => {
        const currVal =
          dateRange.find((cd) => d.enquiry_line === cd.enquiry_line) || 0;

        if (currVal === 0) {
          dataEnquiryLine.push({
            name: this.i18n.service.translate(`d3-${d.enquiry_line}`, lang),
            currValue: 0,
            prevValue: d.sum,
          });
        }
      });

      return dataEnquiryLine.filter(
        (v) => v.currValue > 0 || (v.prevValue || 0) > 0,
      );
    }),
  );

  currentKpiFeedback$ = this.overviewData$.pipe(
    map((data) => {
      const dyfNoCurrent = data?.dateRangeData?.dyf_no || 0;
      const visits = data?.dateRangeData?.visits || 0;

      return dyfNoCurrent / visits;
    }),
  );

  apexKpiFeedback$ = this.store.select(selectDyfNoPerVisitsSeries);

  comparisonKpiFeedback$ = combineLatest([this.overviewData$]).pipe(
    map(([data]) => {
      const dyfNoComparison = data?.comparisonDateRangeData?.dyf_no || 0;
      const visits = data?.comparisonDateRangeData?.visits || 0;

      return dyfNoComparison / visits;
    }),
  );

  kpiFeedbackPercentChange$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(
    map(([currentKpi, comparisonKpi]) =>
      percentChange(currentKpi, comparisonKpi),
    ),
  );

  kpiFeedbackDifference$ = combineLatest([
    this.currentKpiFeedback$,
    this.comparisonKpiFeedback$,
  ]).pipe(map(([currentKpi, comparisonKpi]) => currentKpi - comparisonKpi));

  kpiUXTests$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.uxTests
          ?.filter((uxTest) => typeof uxTest.success_rate === 'number')
          .map(({ success_rate }) => success_rate as number) || [],
    ),
  );

  kpiUXTestsPercent$ = combineLatest([this.kpiUXTests$]).pipe(
    map(([data]) => {
      const kpiUxTestsLength = data.length;
      const kpiUxTestsSum = data.reduce((a, b) => a + b, 0);

      return kpiUxTestsSum / kpiUxTestsLength;
    }),
  );

  kpiUXTestsTotal$ = combineLatest([this.kpiUXTests$]).pipe(
    map(([data]) => {
      return data.length;
    }),
  );

  apexCallDriversChart$ = this.calldriversTable$.pipe(
    map(
      (data) =>
        data.map((d) => ({
          name: d.name,
          data: [d.currValue, d.prevValue],
        })) as ApexAxisChartSeries,
    ),
  );

  apexBar$ = this.store.select(selectVisitsByDayChartData);

  comboChartData$ = this.store.select(selectComboChartData);
  apexCallDrivers$ = this.store.select(selectCallsPerVisitsChartData);

  currentCallVolume$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.dateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.sum,
          0,
        ) || 0,
    ),
  );

  comparisonCallVolume$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.comparisonDateRangeData?.calldriversEnquiry.reduce(
          (totalCalls, enquiryLineCalls) => totalCalls + enquiryLineCalls.sum,
          0,
        ) || 0,
    ),
  );

  callPerVisits$ = combineLatest([this.currentCallVolume$, this.visits$]).pipe(
    map(([currentCalls, visits]) => {
      return currentCalls / visits;
    }),
  );

  callComparisonPerVisits$ = combineLatest([
    this.comparisonCallVolume$,
    this.comparisonVisits$,
  ]).pipe(
    map(([comparisonCalls, comparisonVisits]) => {
      return comparisonCalls / comparisonVisits;
    }),
  );

  callPercentChange$ = combineLatest([
    this.currentCallVolume$,
    this.comparisonCallVolume$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) =>
      percentChange(currentCalls, comparisonVisits),
    ),
  );

  apexCallPercentChange$ = combineLatest([
    this.callPerVisits$,
    this.callComparisonPerVisits$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) =>
      percentChange(currentCalls, comparisonVisits),
    ),
  );

  apexCallDifference$ = combineLatest([
    this.callPerVisits$,
    this.callComparisonPerVisits$,
  ]).pipe(
    map(([currentCalls, comparisonVisits]) => currentCalls - comparisonVisits),
  );

  barTable$ = this.store.select(selectVisitsByDayChartTable);

  tableMerge$ = this.store.select(selectComboChartTable);

  dateRangeLabel$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(([data, lang]) => getWeeklyDatesLabel(data.dateRange, lang)),
  );

  fullDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(map(([data, lang]) => getFullDateRangeLabel(data.dateRange, lang)));

  comparisonDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) =>
      getWeeklyDatesLabel(data.comparisonDateRange || '', lang),
    ),
  );

  fullComparisonDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) =>
      getFullDateRangeLabel(data.comparisonDateRange || '', lang),
    ),
  );

  satDateRangeLabel$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => getWeeklyDatesLabel(data.satDateRange || '', lang)),
  );

  dyfData$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const yes = this.i18n.service.translate('yes', lang);
      const no = this.i18n.service.translate('no', lang);

      const currYesVal = data?.dateRangeData?.dyf_yes || 0;
      const prevYesVal = data?.comparisonDateRangeData?.dyf_yes || NaN;
      const currNoVal = data?.dateRangeData?.dyf_no || 0;
      const prevNoVal = data?.comparisonDateRangeData?.dyf_no || NaN;

      const pieChartData = [
        { name: yes, currValue: currYesVal, prevValue: prevYesVal },
        { name: no, currValue: currNoVal, prevValue: prevNoVal },
      ];

      const filteredPieChartData = pieChartData.filter(
        (v) => v.currValue > 0 || v.prevValue > 0,
      );

      return filteredPieChartData.length > 0 ? filteredPieChartData : [];
    }),
  );

  dyfDataApex$ = combineLatest([this.overviewData$, this.currentLang$]).pipe(
    map(([data, lang]) => {
      const dyfData: ApexAxisChartSeries = [
        {
          name: this.i18n.service.translate('yes', lang),
          data: [
            data?.dateRangeData?.dyf_yes || 0,
            data?.comparisonDateRangeData?.dyf_yes || 0,
          ],
        },
        {
          name: this.i18n.service.translate('no', lang),
          data: [
            data?.dateRangeData?.dyf_no || 0,
            data?.comparisonDateRangeData?.dyf_no || 0,
          ],
        },
      ];

      const isZero = dyfData.every((item) =>
        (item.data as number[]).every(
          (value) => typeof value === 'number' && value === 0,
        ),
      );

      if (isZero) {
        return [];
      }

      return dyfData;
    }),
  );

  whatWasWrongDataApex$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const pieChartData = [
        data?.dateRangeData?.fwylf_cant_find_info || 0,
        data?.dateRangeData?.fwylf_other || 0,
        data?.dateRangeData?.fwylf_hard_to_understand || 0,
        data?.dateRangeData?.fwylf_error || 0,
      ] as ApexNonAxisChartSeries;

      const isZero = pieChartData.every((v) => v === 0);
      if (isZero) {
        return [];
      }

      return pieChartData;
    }),
  );

  whatWasWrongData$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const cantFindInfo = this.i18n.service.translate(
        'd3-cant-find-info',
        lang,
      );
      const otherReason = this.i18n.service.translate('d3-other', lang);
      const hardToUnderstand = this.i18n.service.translate(
        'd3-hard-to-understand',
        lang,
      );
      const error = this.i18n.service.translate('d3-error', lang);

      const pieChartData = [
        {
          name: cantFindInfo,
          value: data?.dateRangeData?.fwylf_cant_find_info || 0,
        },
        { name: otherReason, value: data?.dateRangeData?.fwylf_other || 0 },
        {
          name: hardToUnderstand,
          value: data?.dateRangeData?.fwylf_hard_to_understand || 0,
        },
        {
          name: error,
          value: data?.dateRangeData?.fwylf_error || 0,
        },
      ];

      const isZero = pieChartData.every((v) => v.value === 0);
      if (isZero) {
        return [];
      }

      return pieChartData;
    }),
  );

  searchAssessmentData$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const searchAssessment = data?.dateRangeData?.searchAssessmentData
        .map((d) => {
          const isEnglish = d.lang === 'en';
          const rank = isFinite(d.position) ? Math.round(d.position) : NaN;
          const pass = rank <= 3 && rank > 0 ? 'Pass' : 'Fail';
          const url = d.expected_result?.replace(/^https:\/\//i, '');
          return {
            lang: isEnglish
              ? this.i18n.service.translate('English', lang)
              : this.i18n.service.translate('French', lang),
            query: d.query,
            url: url,
            position: rank === 0 ? '-' : rank,
            pass: pass,
            total_searches: d.total_searches,
            total_clicks: d.total_clicks,
            target_clicks: d.target_clicks,
          };
        })
        .sort(
          (a, b) =>
            a.lang.localeCompare(b.lang) || b.total_searches - a.total_searches,
        );

      return [...(searchAssessment || [])];
    }),
  );

  searchAssessmentPassed$ = combineLatest([
    this.searchAssessmentData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return {
        passed: data.filter((d) => d.pass === 'Pass').length,
        total: data.length,
      };
    }),
  );

  comparisonSearchAssessmentData$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      return data?.comparisonDateRangeData?.searchAssessmentData
        .map((d) => {
          const isEnglish = d.lang === 'en';
          const rank = isFinite(d.position) ? Math.round(d.position) : NaN;
          const pass = rank <= 3 && rank > 0 ? 'Pass' : 'Fail';
          const url = d.expected_result?.replace(/^https:\/\//i, '');
          return {
            lang: isEnglish
              ? this.i18n.service.translate('English', lang)
              : this.i18n.service.translate('French', lang),
            query: d.query,
            url: url,
            position: rank,
            pass: pass,
            total_searches: d.total_searches,
            total_clicks: d.total_clicks,
            target_clicks: d.target_clicks,
          };
        })
        .sort(
          (a, b) =>
            a.lang.localeCompare(b.lang) || b.total_searches - a.total_searches,
        );
    }),
  );

  currentKpiSearchAssessment$ = combineLatest([
    this.searchAssessmentData$,
  ]).pipe(
    map(([searchAssessmentData]) => {
      const kpiSearchAssessment = searchAssessmentData || [];
      return (
        kpiSearchAssessment.filter((d) => d.pass === 'Pass').length /
        kpiSearchAssessment.length
      );
    }),
  );

  comparisonKpiSearchAssessment$ = combineLatest([
    this.comparisonSearchAssessmentData$,
  ]).pipe(
    map(([comparisonSearchAssessmentData]) => {
      const kpiSearchAssessment = comparisonSearchAssessmentData || [];
      return (
        kpiSearchAssessment.filter((d) => d.pass === 'Pass').length /
        kpiSearchAssessment.length
      );
    }),
  );

  kpiSearchAssessmentPercentChange$ = combineLatest([
    this.currentKpiSearchAssessment$,
    this.comparisonKpiSearchAssessment$,
  ]).pipe(
    map(([currentKpiSearchAssessment, comparisonKpiSearchAssessment]) => {
      return percentChange(
        currentKpiSearchAssessment,
        comparisonKpiSearchAssessment,
      );
    }),
  );

  comparisonFeedbackPagesTable$ = combineLatest([
    this.overviewData$,
    this.currentLang$,
  ]).pipe(
    map(([data, lang]) => {
      const dateRange = data?.dateRangeData?.feedbackPages || [];
      const comparisonDateRange =
        data?.comparisonDateRangeData?.feedbackPages || [];

      const dataFeedback = dateRange.map((d, i) => {
        let prevVal = NaN;
        comparisonDateRange.map((cd, i) => {
          if (d.url === cd.url) {
            prevVal = cd.sum;
          }
        });
        return {
          name: this.i18n.service.translate(`${d.url}`, lang),
          currValue: d.sum,
          prevValue: prevVal,
          id: d._id,
          title: d.title,
        };
      });

      comparisonDateRange.map((d, i) => {
        let currValue = 0;
        dateRange.map((cd, i) => {
          if (d.url === cd.url) {
            currValue = cd.sum;
          }
        });
        if (currValue === 0) {
          dataFeedback.push({
            name: this.i18n.service.translate(`${d.url}`, lang),
            currValue: 0,
            prevValue: d.sum,
            id: d._id,
            title: d.title,
          });
        }
      });

      return dataFeedback
        .map((val: any, i) => ({
          ...val,
          percentChange: percentChange(val.currValue, val.prevValue),
        }))
        .filter((v) => v.currValue > 0 || v.prevValue > 0)
        .sort((a, b) => b.currValue - a.currValue)
    }),
  );

  currentTotalComments$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.dateRangeData?.feedbackPages.reduce(
          (totalComments, feedback) => totalComments + feedback.sum,
          0,
        ) || 0,
    ),
  );

  comparisonTotalComments$ = this.overviewData$.pipe(
    map(
      (data) =>
        data?.comparisonDateRangeData?.feedbackPages.reduce(
          (totalComments, feedback) => totalComments + feedback.sum,
          0,
        ) || 0,
    ),
  );

  commentsPercentChange$ = combineLatest([
    this.currentTotalComments$,
    this.comparisonTotalComments$,
  ]).pipe(
    map(([currentComments, comparisonComments]) =>
      percentChange(currentComments, comparisonComments),
    ),
  );

  uxTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data.testsCompletedSince2018),
  );
  uxTasksTested$ = this.overviewData$.pipe(
    map((data) => data.tasksTestedSince2018),
  );
  uxParticipantsTested$ = this.projectsList$.pipe(
    map((data) => data.reduce((a, b) => a + b.totalUsers, 0)),
  );
  uxTestsConductedLastFiscal$ = this.overviewData$.pipe(
    map((data) => data.testsConductedLastFiscal),
  );
  uxTestsConductedLastQuarter$ = this.overviewData$.pipe(
    map((data) => data.testsConductedLastQuarter),
  );
  uxCopsTestsCompleted$ = this.overviewData$.pipe(
    map((data) => data.copsTestsCompletedSince2018),
  );

  calldriverTopics$ = this.overviewData$.pipe(
    map((data) =>
      data.calldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        tpc_id: topicData.tpc_id || '',
        enquiry_line: topicData.enquiry_line || '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        calls: topicData.calls,
        change: topicData.change,
      })),
    ),
  );

  calldriverTopicsConfig$ = createColConfigWithI18n(this.i18n.service, [
    { field: 'tpc_id', header: 'tpc_id', translate: true},   
    { field: 'enquiry_line', header: 'enquiry_line', translate: true},
    { field: 'topic', header: 'topic', translate: true },
    { field: 'subtopic', header: 'sub-topic', translate: true },
    { field: 'sub_subtopic', header: 'sub-subtopic', translate: true },
    { field: 'calls', header: 'calls', pipe: 'number' },
    { field: 'change', header: 'comparison', pipe: 'percent' },
  ]);

  gcTasksTable$ = this.overviewData$.pipe(
    map((data) =>
      data?.dateRangeData?.gcTasksData.map((d) => {
        const data_reliability = evaluateDataReliability(
          d.margin_of_error,
        );
        const baseData = { ...d, data_reliability };

        return data_reliability === 'Insufficient data'
          ? {
              ...baseData,
              able_to_complete: NaN,
              ease: NaN,
              satisfaction: NaN,
              margin_of_error: NaN,
            }
          : baseData;
      }),
    ),
  );

  gcTasksTableConfig$ = createColConfigWithI18n(this.i18n.service, [
    { field: 'gc_task', header: 'gc_task', translate: true },
    { field: 'theme', header: 'theme', translate: true },
    { field: 'total_entries', header: 'total-entries', pipe: 'number' },
    {
      field: 'able_to_complete',
      header: 'able-to-complete',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'ease',
      header: 'ease',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'satisfaction',
      header: 'satisfaction',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    {
      field: 'margin_of_error',
      header: 'margin-of-error',
      translate: true,
      pipe: 'percent',
      pipeParam: '1.0-1',
    },
    { field: 'data_reliability', header: 'data-reliability', translate: true },
  ]);

  gcTasksCommentsTable$ = this.overviewData$.pipe(
    map((data) =>
      data?.dateRangeData?.gcTasksComments || [],
    ),
  );

  gcTasksCommentsTableConfig$ = createColConfigWithI18n(this.i18n.service, [
    { field: 'date', header: 'Date', pipe: 'date' },
    { field: 'gc_task', header: 'gc_task', translate: true },
    { field: 'gc_task_other', header: 'Other GC Task', translate: true, hide: true },
    { field: 'url', header: 'Survey Referrer', translate: true, hide: true },
    { field: 'language', header: 'Language', translate: true, hide: true },
    { field: 'device', header: 'Device', translate: true, hide: true },
    { field: 'screener', header: 'Screener', translate: true, hide: true },
    { field: 'theme', header: 'Theme', translate: true, hide: true },
    { field: 'grouping', header: 'Grouping', translate: true, hide: true, tooltip: 'tooltip-grouping' },
    { field: 'able_to_complete', header: 'Able to Complete', translate: true },
    { field: 'ease', header: 'ease', translate: true },
    { field: 'satisfaction', header: 'satisfaction', translate: true },
    { field: 'what_would_improve', header: 'What Would Improve', translate: true, hide: true },
    { field: 'what_would_improve_comment', header: 'Improvement Comment', translate: true, tooltip: 'tooltip-improvement-comment' },
    { field: 'reason_not_complete', header: 'Reason Not Complete', translate: true, hide: true },
    { field: 'reason_not_complete_comment', header: 'Reason Not Complete Comment', translate: true, tooltip: 'tooltip-notcomplete-comment' },
  ]);

  top5IncreasedCalldriverTopics$ = this.overviewData$.pipe(
    map((data) =>
      data.top5IncreasedCalldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        calls: topicData.calls,
        change: topicData.change,
      })),
    ),
  );

  top5IncreasedCalldriverTopicsConfig$ = createColConfigWithI18n(
    this.i18n.service,
    [
      { field: 'topic', header: 'topic', translate: true },
      { field: 'subtopic', header: 'sub-topic', translate: true },
      { field: 'sub_subtopic', header: 'sub-subtopic', translate: true },
      { field: 'calls', header: 'calls', pipe: 'number' },
      { field: 'change', header: 'comparison', pipe: 'percent' },
    ],
  );

  top5DecreasedCalldriverTopics$ = this.overviewData$.pipe(
    map((data) =>
      data.top5DecreasedCalldriverTopics.map((topicData) => ({
        topic: topicData.topic || '',
        subtopic: topicData.subtopic || '',
        sub_subtopic: topicData.sub_subtopic || '',
        calls: topicData.calls,
        change: topicData.change,
      })),
    ),
  );

  top5DecreasedCalldriverTopicsConfig$ = createColConfigWithI18n(
    this.i18n.service,
    [
      { field: 'topic', header: 'topic', translate: true },
      { field: 'subtopic', header: 'sub-topic', translate: true },
      { field: 'sub_subtopic', header: 'sub-subtopic', translate: true },
      { field: 'calls', header: 'calls', pipe: 'number' },
      { field: 'change', header: 'comparison', pipe: 'percent' },
    ],
  );

  top20SearchTermsEn$ = this.overviewData$.pipe(
    map((data) => data?.searchTermsEn),
  );
  top20SearchTermsFr$ = this.overviewData$.pipe(
    map((data) => data?.searchTermsFr),
  );

  searchTermsColConfig$ = createColConfigWithI18n<
    UnwrapObservable<typeof this.top20SearchTermsEn$>
  >(this.i18n.service, [
    { field: 'term', header: 'search-term' },
    { field: 'total_searches', header: 'Total searches', pipe: 'number' },
    {
      field: 'searchesChange',
      header: 'comparison-for-searches',
      pipe: 'percent',
    },
    { field: 'clicks', header: 'clicks', pipe: 'number' },
    { field: 'ctr', header: 'ctr', pipe: 'percent' },
    {
      field: 'position',
      header: 'position',
      pipe: 'number',
      pipeParam: '1.0-2',
    },
  ]);

  error$ = this.store.select(OverviewSelectors.selectOverviewError);
  

 
  

  init() {
    this.store.dispatch(OverviewActions.init());
  }
}

const getWeeklyDatesLabel = (dateRange: string, lang: LocaleId) => {
  const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

  const dateFormat = lang === FR_CA ? 'D MMM' : 'MMM D';

  const formattedStartDate = dayjs
    .utc(startDate)
    .locale(lang)
    .format(dateFormat);
  const formattedEndDate = dayjs.utc(endDate).locale(lang).format(dateFormat);

  return `${formattedStartDate}-${formattedEndDate}`;
};

const getFullDateRangeLabel = (dateRange: string, lang: LocaleId) => {
  const [startDate, endDate] = dateRange.split('/');

  const dateFormat = lang === FR_CA ? 'D MMM YYYY' : 'MMM D YYYY';
  const separator = lang === FR_CA ? ' au' : ' to';

  const formattedStartDate = dayjs
    .utc(startDate)
    .locale(lang)
    .format(dateFormat);

  const formattedEndDate = dayjs.utc(endDate).locale(lang).format(dateFormat);

  return [`${formattedStartDate}${separator}`, `${formattedEndDate}`];
};

type DateRangeDataIndexKey = keyof OverviewAggregatedData &
  keyof PickByType<OverviewAggregatedData, number>;

// helper function to get the percent change of a property vs. the comparison date range
function mapToPercentChange(
  propName: keyof PickByType<OverviewAggregatedData, number>,
) {
  return map((data: OverviewData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return 0;
    }

    const current = data?.dateRangeData[propName as DateRangeDataIndexKey];
    const previous =
      data?.comparisonDateRangeData[propName as DateRangeDataIndexKey];

    if (!current || !previous) {
      return 0;
    }

    return percentChange(current, previous);
  });
}

function mapObjectArraysWithPercentChange(
  propName: keyof OverviewAggregatedData,
  propPath: string,
  sortPath?: string,
) {
  return map((data: OverviewData) => {
    if (!data?.dateRangeData || !data?.comparisonDateRangeData) {
      return;
    }

    const current = [...((data?.dateRangeData?.[propName] || []) as any[])];
    const previous = [
      ...((data?.comparisonDateRangeData?.[propName] || []) as any[]),
    ];

    if (!current || !previous) {
      return;
    }

    const propsAreValidArrays =
      Array.isArray(current) &&
      Array.isArray(previous) &&
      current.length > 0 &&
      previous.length > 0 &&
      current.length === previous.length;

    if (propsAreValidArrays) {
      const sortBy = (a: any, b: any) => {
        if (sortPath && a[sortPath] instanceof Date) {
          return a[sortPath] - b[sortPath];
        }

        if (sortPath && typeof a[sortPath] === 'string') {
          return a[sortPath].localeCompare(b[sortPath]);
        }

        return 0;
      };

      current.sort(sortBy);
      previous.sort(sortBy);

      return current.map((val: any, i) => ({
        ...val,
        percentChange: percentChange(
          val[propPath],
          (previous as any)[i][propPath],
        ),
      }));
    }

    throw Error('Invalid data arrays in mapObjectArraysWithPercentChange');
  });
}

function evaluateDataReliability(errorMargin: number) {
  if (errorMargin > 0 && errorMargin < 0.05)
    return 'Low margin of error/Reliable data';
  if (errorMargin >= 0.05 && errorMargin < 0.1)
    return 'Higher margin of error/Use data with caution';
  return 'Insufficient data';
}