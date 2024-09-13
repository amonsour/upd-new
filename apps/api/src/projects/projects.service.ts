import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  type CallDriverModel,
  DbService,
  type FeedbackModel,
  PageDocument,
  type PageMetricsModel,
  ProjectDocument,
  UxTestDocument,
} from '@dua-upd/db';
import {
  CallDriver,
  Feedback,
  Page,
  PageMetrics,
  Project,
  Task,
  UxTest,
} from '@dua-upd/db';
import type {
  ApiParams,
  InternalSearchTerm,
  ProjectsDetailsData,
  ProjectDetailsAggregatedData,
  ProjectsHomeProject,
  ProjectStatus,
  ProjectsHomeData,
  DateRange,
} from '@dua-upd/types-common';
import {
  dateRangeSplit,
  parseDateRangeString,
} from '@dua-upd/utils-common/date';
import {
  getArraySelectedPercentChange,
  getLatestTest,
  getLatestTestData,
} from '@dua-upd/utils-common/data';
import { AsyncLogTiming, percentChange } from '@dua-upd/utils-common';
import { FeedbackService } from '@dua-upd/api/feedback';

dayjs.extend(utc);

const projectStatusSwitchExpression = {
  $switch: {
    branches: [
      {
        case: {
          $and: [
            { $gt: [{ $size: '$statuses' }, 0] },
            {
              $allElementsTrue: {
                $map: {
                  input: '$statuses',
                  as: 'status',
                  in: { $eq: ['$$status', 'Complete'] },
                },
              },
            },
          ],
        },
        then: 'Complete',
      },
      {
        case: {
          $in: ['Delayed', '$statuses'],
        },
        then: 'Delayed',
      },
      {
        case: {
          $in: ['In Progress', '$statuses'],
        },
        then: 'In Progress',
      },
      {
        case: {
          $in: ['Planning', '$statuses'],
        },
        then: 'Planning',
      },
      {
        case: {
          $in: ['Exploratory', '$statuses'],
        },
        then: 'Exploratory',
      },
      {
        case: {
          $in: ['Being monitored', '$statuses'],
        },
        then: 'Being monitored',
      },
      {
        case: {
          $in: ['Needs review', '$statuses'],
        },
        then: 'Needs review',
      },
      {
        case: {
          $in: ['Paused', '$statuses'],
        },
        then: 'Paused',
      },
    ],
    default: 'Unknown',
  },
};

const getProjectStatus = (statuses: ProjectStatus[]): ProjectStatus => {
  if (statuses.length === 0) {
    return 'Unknown';
  }

  switch (true) {
    case statuses.every((status) => status === 'Complete'):
      return 'Complete';
    case statuses.some((status) => status === 'Delayed'):
      return 'Delayed';
    case statuses.some((status) => status === 'In Progress'):
      return 'In Progress';
    case statuses.some((status) => status === 'Planning'):
      return 'Planning';
    case statuses.some((status) => status === 'Exploratory'):
      return 'Exploratory';
    case statuses.some((status) => status === 'Being monitored'):
      return 'Being monitored';
    case statuses.some((status) => status === 'Needs review'):
      return 'Needs review';
    case statuses.some((status) => status === 'Paused'):
      return 'Paused';
    default:
      return 'Unknown';
  }
};

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DbService)
    private db: DbService,
    @InjectModel(CallDriver.name, 'defaultConnection')
    private calldriversModel: CallDriverModel,
    @InjectModel(PageMetrics.name, 'defaultConnection')
    private pageMetricsModel: PageMetricsModel,
    @InjectModel(Project.name, 'defaultConnection')
    private projectsModel: Model<ProjectDocument>,
    @InjectModel(UxTest.name, 'defaultConnection')
    private uxTestsModel: Model<UxTestDocument>,
    @InjectModel(Feedback.name, 'defaultConnection')
    private feedbackModel: FeedbackModel,
    @InjectModel(Page.name, 'defaultConnection')
    private pageModel: Model<PageDocument>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private feedbackService: FeedbackService,
  ) {}

  async getProjectsHomeData(): Promise<ProjectsHomeData> {
    const cacheKey = `getProjectsHomeData`;
    const cachedData =
      await this.cacheManager.store.get<ProjectsHomeData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const defaultData = {
      numInProgress: 0,
      numPlanning: 0,
      numCompletedLast6Months: 0,
      totalCompleted: 0,
      numDelayed: 0,
    };

    const sixMonthsAgo = dayjs().utc(false).subtract(6, 'months').toDate();

    const aggregatedData =
      (
        await this.uxTestsModel
          .aggregate<Omit<ProjectsHomeData, 'projects'>>()
          .group({
            _id: '$project',
            statuses: {
              $addToSet: '$status',
            },
            date: { $min: '$date' },
          })
          .project({
            last6Months: {
              $gte: ['$date', sixMonthsAgo],
            },
            status: projectStatusSwitchExpression,
          })
          .sort({ status: 1 })

          .group({
            _id: '$status',
            count: { $sum: 1 },
            countLast6Months: {
              $sum: {
                $cond: [{ $gte: ['$date', sixMonthsAgo] }, 1, 0],
              },
            },
          })
          .group({
            _id: null,
            numInProgress: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'In Progress'] }, '$count', 0],
              },
            },
            completedLast6Months: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'Complete'] }, '$countLast6Months', 0],
              },
            },
            totalCompleted: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'Complete'] }, '$count', 0],
              },
            },
            numPlanning: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'Planning'] }, '$count', 0],
              },
            },
            numDelayed: {
              $sum: {
                $cond: [{ $eq: ['$_id', 'Delayed'] }, '$count', 0],
              },
            },
          })
          .project({
            _id: 0,
            numInProgress: 1,
            numPlanning: 1,
            numCompletedLast6Months: 1,
            totalCompleted: 1,
            numDelayed: 1,
          })
          .exec()
      )[0] || defaultData;

    const projectsData = await this.projectsModel
      .aggregate<ProjectsHomeProject>()
      .lookup({
        from: 'ux_tests',
        let: { project_id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$project', '$$project_id'],
              },
            },
          },
          {
            $group: {
              _id: null,
              cops: {
                $max: '$cops',
              },
              startDate: {
                $min: '$date',
              },
              launchDate: {
                $max: '$launch_date',
              },

              uxTests: {
                $push: {
                  success_rate: '$success_rate',
                  date: '$date',
                  test_type: '$test_type',
                },
              },
              avgSuccessRate: {
                $avg: '$success_rate',
              },
              statuses: {
                $addToSet: '$status',
              },
            },
          },
          {
            $addFields: {
              status: projectStatusSwitchExpression,
            },
          },
        ],
        as: 'tests_aggregated',
      })
      .unwind('$tests_aggregated')
      .replaceRoot({
        $mergeObjects: ['$$ROOT', '$tests_aggregated', { _id: '$_id' }],
      })
      .project({
        title: 1,
        cops: 1,
        startDate: 1,
        launchDate: 1,
        avgSuccessRate: 1,
        status: 1,
        uxTests: 1,
      });

    const completedCOPS = projectsData.filter(
      (data) => data.cops && data.status === 'Complete',
    ).length;

    for (const data of projectsData) {
      const { avgTestSuccess } = getLatestTestData(data.uxTests);

      data.lastAvgSuccessRate = avgTestSuccess;
    }

    const results = {
      ...aggregatedData,
      completedCOPS: completedCOPS,
      projects: projectsData,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }

  @AsyncLogTiming
  async getProjectDetails(params: ApiParams): Promise<ProjectsDetailsData> {
    if (!params.id) {
      throw Error(
        'Attempted to get Project details from API but no id was provided.',
      );
    }

    const cacheKey = `getProjectDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData =
      await this.cacheManager.store.get<ProjectsDetailsData>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const projectId = new Types.ObjectId(params.id);

    console.time('findById');
    const projectDoc = await this.projectsModel.findById(projectId);
    console.timeEnd('findById');

    if (projectDoc === null) {
      return;
    }

    console.time('populate');
    const populatedProjectDoc = (await this.projectsModel
      .findById(projectId, {
        title: 1,
        description: 1,
        tasks: 1,
        ux_tests: 1,
        attachments: 1,
      })
      .populate([
        {
          path: 'tasks',
          select: '_id title',
        },
        {
          path: 'ux_tests',
          select: '-project -pages',
          populate: {
            path: 'tasks',
            select: '_id title',
          },
        },
      ])
      .exec()) as Project;
    console.timeEnd('populate');

    const title = populatedProjectDoc.title;

    console.time('getProjectStatus');
    const status = getProjectStatus(
      (populatedProjectDoc.ux_tests as UxTest[])
        .filter((test) => !(test instanceof Types.ObjectId))
        .map((test) => test.status as ProjectStatus),
    );
    console.timeEnd('getProjectStatus');

    const cops = (populatedProjectDoc.ux_tests as UxTest[])
      .filter((test) => !(test instanceof Types.ObjectId))
      .some((test) => test.cops);

    const description = populatedProjectDoc.description;

    console.time('uxTests');
    const uxTests = populatedProjectDoc.ux_tests.map((uxTest) => {
      uxTest = uxTest._doc;

      if (!('tasks' in uxTest) || !uxTest.tasks.length) {
        return {
          ...uxTest,
          tasks: '',
        };
      }

      const tasks =
        uxTest.tasks.length > 1
          ? uxTest.tasks.map((task) => task._doc.title).join('; ')
          : uxTest.tasks[0].title;

      return {
        ...uxTest,
        tasks,
      };
    }) as (Partial<UxTest> & { tasks: string })[];

    console.timeEnd('uxTests');

    console.time('getLatestTest');
    const lastTest = getLatestTest(uxTests);
    console.timeEnd('getLatestTest');

    const dateFromLastTest: Date | null = lastTest?.date || null;

    console.time('getLatestTestData');
    const { percentChange: projectPercentChange, avgTestSuccess } =
      getLatestTestData(uxTests);

    const last_task_success_percent_change = percentChange(
      avgTestSuccess,
      avgTestSuccess - projectPercentChange,
    );

    console.timeEnd('getLatestTestData');

    const tasks = populatedProjectDoc.tasks as Task[];

    const startDate = uxTests
      .find((uxTest) => uxTest.start_date)
      ?.start_date.toISOString();

    const launchDate = uxTests
      .find((uxTest) => uxTest.launch_date)
      ?.launch_date.toISOString();

    const members = uxTests.find((uxTest) => uxTest.project_lead)?.project_lead;

    console.time('dateRangeData');
    const dateRangeData = await this.getAggregatedMetrics(
      projectId,
      params.dateRange,
    );
    console.timeEnd('dateRangeData');

    console.time('comparisonDateRangeData');
    const comparisonDateRangeData = await this.getAggregatedMetrics(
      projectId,
      params.comparisonDateRange,
    );
    console.timeEnd('comparisonDateRangeData');

    console.time('getTopSearchTerms');
    const searchTerms = await this.getTopSearchTerms(
      params.dateRange,
      params.comparisonDateRange,
      projectId,
    );
    console.timeEnd('getTopSearchTerms');

    console.time('commentsByPage');
    const feedbackByPage = (
      await this.feedbackService.getNumCommentsByPage(
        params.dateRange,
        params.comparisonDateRange,
        { projects: projectId },
      )
    )
      .map(({ _id, title, url, sum, percentChange }) => ({
        _id: _id.toString(),
        title,
        url,
        sum,
        percentChange,
      }))
      .sort((a, b) => b.sum - a.sum);
    console.log(feedbackByPage.length);
    console.timeEnd('commentsByPage');

    const mostRelevantCommentsAndWords =
      await this.feedbackService.getMostRelevantCommentsAndWords({
        dateRange: parseDateRangeString(params.dateRange),
        type: 'project',
        id: params.id,
      });

    const numComments =
      mostRelevantCommentsAndWords.en.comments.length +
      mostRelevantCommentsAndWords.fr.comments.length;

    const { start: prevDateRangeStart, end: prevDateRangeEnd } =
      parseDateRangeString(params.comparisonDateRange);

    const numPreviousComments = await this.feedbackModel
      .countDocuments({
        date: { $gte: prevDateRangeStart, $lte: prevDateRangeEnd },
      })
      .exec();

    const numCommentsPercentChange = numPreviousComments
      ? percentChange(numComments, numPreviousComments)
      : null;

    const results = {
      _id: populatedProjectDoc._id.toString(),
      dateRange: params.dateRange,
      comparisonDateRange: params.comparisonDateRange,
      dateRangeData,
      comparisonDateRangeData,
      title,
      status,
      cops,
      description,
      startDate,
      launchDate,
      members,
      avgTaskSuccessFromLastTest: avgTestSuccess,
      avgSuccessValueChange: projectPercentChange,
      avgSuccessPercentChange: last_task_success_percent_change,
      dateFromLastTest,
      taskSuccessByUxTest: uxTests,
      tasks,
      searchTerms,
      attachments: populatedProjectDoc.attachments.map((attachment) => {
        attachment.storage_url = attachment.storage_url?.replace(
          /^https:\/\//,
          '',
        );

        return attachment;
      }),
      feedbackByPage,
      feedbackByDay: (
        await this.feedbackModel.getCommentsByDay(params.dateRange, {
          projects: projectId,
        })
      ).map(({ date, sum }) => ({
        date: date.toISOString(),
        sum,
      })),
      mostRelevantCommentsAndWords:
        await this.feedbackService.getMostRelevantCommentsAndWords({
          dateRange: parseDateRangeString(params.dateRange),
          type: 'project',
          id: params.id,
        }),
      numComments,
      numCommentsPercentChange,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }

  async getAggregatedMetrics(
    id: Types.ObjectId,
    dateRange: string,
  ): Promise<ProjectDetailsAggregatedData> {
    const [start, end] = dateRangeSplit(dateRange);

    const project = await this.projectsModel
      .findById(id)
      .populate<{ tasks: Task[] }>('tasks');
    const tasks = project?.tasks || [];

    const projectMetrics = await this.db.views.pages
      .aggregate<
        Omit<
          ProjectDetailsAggregatedData,
          | 'visitsByDay'
          | 'dyfByDay'
          | 'calldriversByDay'
          | 'feedbackByPage'
          | 'calldriversEnquiry'
          | 'callsByTopic'
          | 'callsByTasks'
          | 'totalCalldrivers'
        >
      >({
        dateRange: { start, end },
        projects: id,
        'projects.0': { $exists: true },
      })
      .group({
        _id: '$page._id',
        page: { $first: '$page' },
        pageStatus: { $first: '$pageStatus' },
        visits: { $sum: '$visits' },
        dyfYes: { $sum: '$dyf_yes' },
        dyfNo: { $sum: '$dyf_no' },
        gscTotalClicks: { $sum: '$gsc_total_clicks' },
        gscTotalImpressions: { $sum: '$gsc_total_impressions' },
        gscTotalCtr: { $avg: '$gsc_total_ctr' },
        gscTotalPosition: { $avg: '$gsc_total_position' },
      })
      .addFields({
        url: '$page.url',
        title: '$page.title',
        page: '$page._id',
        redirect: '$page.redirect',
        owners: '$page.owners',
        sections: '$page.sections',
      })
      .sort({ title: 1 })
      .group({
        _id: null,
        visitsByPage: {
          $push: '$$ROOT',
        },
        visits: { $sum: '$visits' },
        dyfYes: { $sum: '$dyfYes' },
        dyfNo: { $sum: '$dyfNo' },
        gscTotalClicks: { $sum: '$gscTotalClicks' },
        gscTotalImpressions: { $sum: '$gscTotalImpressions' },
        gscTotalCtr: { $avg: '$gscTotalCtr' },
        gscTotalPosition: { $avg: '$gscTotalPosition' },
        owners: { $first: '$owners' },
        sections: { $first: '$sections' },
      })
      .exec()
      .then((data) => data?.[0]);

    const metricsByDay = await this.pageMetricsModel
      .aggregate<{
        date: string;
        visits: number;
        dyf_yes: number;
        dyf_no: number;
        dyf_submit: number;
      }>()
      .match({
        date: { $gte: start, $lte: end },
        projects: id,
        'projects.0': { $exists: true },
      })
      .group({
        _id: '$date',
        visits: { $sum: '$visits' },
        dyf_yes: { $sum: '$dyf_yes' },
        dyf_no: { $sum: '$dyf_no' },
        dyf_submit: { $sum: '$dyf_submit' },
      })
      .project({
        _id: 0,
        date: '$_id',
        visits: 1,
        dyf_yes: 1,
        dyf_no: 1,
        dyf_submit: 1,
      })
      .sort({ date: 1 })
      .exec()
      .then((data) => data || []);

    const visitsByDay = metricsByDay.map(({ date, visits }) => ({
      date,
      visits,
    }));

    const dyfByDay = metricsByDay.map(
      ({ date, dyf_yes, dyf_no, dyf_submit }) => ({
        date,
        dyf_yes,
        dyf_no,
        dyf_submit,
      }),
    );

    const calldriversByDay = await this.calldriversModel
      .aggregate<{ date: string; calls: number }>()
      .match({
        date: { $gte: start, $lte: end },
        projects: id,
      })
      .group({
        _id: '$date',
        calls: {
          $sum: '$calls',
        },
      })
      .project({
        _id: 0,
        date: '$_id',
        calls: 1,
      })
      .sort({ date: 1 })
      .exec();

    const calldriversEnquiry =
      await this.calldriversModel.getCallsByEnquiryLine(dateRange, {
        projects: id,
      });

    const callsByTopic = await this.calldriversModel.getCallsByTopic(
      dateRange,
      {
        projects: id,
      },
    );

    const tpcIds = tasks
      .filter((task: Types.ObjectId | Task) => 'tpc_ids' in task)
      .map((task: Task) => task.tpc_ids)
      .flat();

    const callsByTasks = await this.calldriversModel.getCallsByTaskFromIds(
      dateRange,
      tpcIds,
    );

    const totalCalldrivers = calldriversEnquiry.reduce(
      (a, b) => a + b.calls,
      0,
    );

    const taskIds = tasks.map((task: Types.ObjectId | Task) => task._id);

    console.time('pageMetricsByTasks');

    const pageMetricsByTasks = await this.pageMetricsModel
      .aggregate<Partial<ProjectDetailsAggregatedData> & { title: string }>()
      .match({
        date: { $gte: start, $lte: end },
        tasks: { $elemMatch: { $in: taskIds } },
        projects: id,
      })
      .lookup({
        from: 'tasks',
        localField: 'tasks',
        foreignField: '_id',
        as: 'task',
      })
      .unwind('$task')
      .match({ 'task._id': { $in: taskIds } })
      .group({
        _id: { taskId: '$task._id', taskTitle: '$task.title' },
        page: { $first: '$page' },
        visits: { $sum: '$visits' },
        dyfYes: { $sum: '$dyf_yes' },
        dyfNo: { $sum: '$dyf_no' },
        fwylfCantFindInfo: { $sum: '$fwylf_cant_find_info' },
        fwylfHardToUnderstand: { $sum: '$fwylf_hard_to_understand' },
        fwylfOther: { $sum: '$fwylf_other' },
        fwylfError: { $sum: '$fwylf_error' },
        gscTotalClicks: { $sum: '$gsc_total_clicks' },
        gscTotalImpressions: { $sum: '$gsc_total_impressions' },
        gscTotalCtr: { $avg: '$gsc_total_ctr' },
        gscTotalPosition: { $avg: '$gsc_total_position' },
      })
      .project({
        _id: 0,
        title: '$_id.taskTitle',
        pages: 1, // add this line to include the page array in the output
        visits: 1,
        dyfYes: 1,
        dyfNo: 1,
        fwylfCantFindInfo: 1,
        fwylfHardToUnderstand: 1,
        fwylfOther: 1,
        fwylfError: 1,
        gscTotalClicks: 1,
        gscTotalImpressions: 1,
        gscTotalCtr: 1,
        gscTotalPosition: 1,
      })
      .exec();

    console.timeEnd('pageMetricsByTasks');

    return {
      ...projectMetrics,
      calldriversEnquiry,
      callsByTopic,
      totalCalldrivers,
      visitsByDay,
      dyfByDay,
      calldriversByDay,
      pageMetricsByTasks,
      callsByTasks,
    };
  }

  async getTopSearchTerms(
    dateRange: string,
    comparisonDateRange: string,
    id: Types.ObjectId,
  ): Promise<InternalSearchTerm[]> {
    const [start, end] = dateRangeSplit(dateRange);
    const [prevStart, prevEnd] = dateRangeSplit(comparisonDateRange);

    const searchTermsPipeline = (
      dateRange: DateRange<Date>,
      termsToFind?: string[],
    ) => {
      const pipelineBase = this.db.views.pages
        .aggregate<InternalSearchTerm>({
          dateRange,
          projects: id,
          'projects.0': { $exists: true },
        })
        .project({ dateRange: 1, aa_searchterms: 1, projects: 1 })
        .unwind('$aa_searchterms')
        .addFields({
          'aa_searchterms.term': {
            $toLower: '$aa_searchterms.term',
          },
        });

      const pipeline = termsToFind
        ? pipelineBase.match({ 'aa_searchterms.term': { $in: termsToFind } })
        : pipelineBase;

      return pipeline
        .group({
          _id: '$aa_searchterms.term',
          clicks: {
            $sum: '$aa_searchterms.clicks',
          },
          position: {
            $avg: '$aa_searchterms.position',
          },
        })
        .project({
          _id: 0,
          term: '$_id',
          clicks: 1,
          position: {
            $round: ['$position', 2],
          },
        });
    };

    const results = await searchTermsPipeline({ start, end })
      .sort({ clicks: -1 })
      .limit(10)
      .exec()
      .then((searchTerms) => searchTerms || []);

    const prevResults = await searchTermsPipeline(
      { start: prevStart, end: prevEnd },
      results.map((term) => term.term),
    )
      .exec()
      .then((searchTerms) => searchTerms || []);

    return getArraySelectedPercentChange(
      ['clicks'],
      'term',
      results,
      prevResults,
      { round: 2, suffix: 'Change' },
    );
  }
}
