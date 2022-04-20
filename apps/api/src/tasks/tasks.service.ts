import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cache } from 'cache-manager';
import { PageMetrics, Project, Task, UxTest } from '@cra-arc/db';
import type {
  PageMetricsModel,
  ProjectDocument,
  TaskDocument,
  TaskDetailsData,
  TasksHomeData,
  TaskDetailsAggregatedData,
  UxTestDocument,
} from '@cra-arc/types-common';
import type { ApiParams } from '@cra-arc/upd/services';
import { TasksHomeAggregatedData } from '@cra-arc/types-common';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(UxTest.name) private uxTestModel: Model<UxTestDocument>,
    @InjectModel(PageMetrics.name) private pageMetricsModel: PageMetricsModel,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  async getTasksHomeData(dateRange: string): Promise<TasksHomeData> {
    const cacheKey = `getTasksHomeData-${dateRange}`;
    const cachedData = await this.cacheManager.store.get<TasksHomeData>(
      cacheKey
    );

    if (cachedData) {
      return cachedData;
    }

    const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

    const tasksData = await this.pageMetricsModel
      .aggregate<TasksHomeAggregatedData>()
      .project({ date: 1, visits: 1, tasks: 1 })
      .sort({ tasks: 1, date: 1 }) // todo: add index for this sort
      .match({
        $and: [
          {
            tasks: { $exists: true },
          },
          {
            tasks: { $ne: null },
          },
          {
            tasks: { $not: { $size: 0 } },
          },
          { date: { $gte: startDate, $lte: endDate } },
        ],
      })
      .unwind({ path: '$tasks' })
      .sort({ tasks: 1 })
      .group({
        _id: '$tasks',
        visits: {
          $sum: '$visits',
        },
      })
      .lookup({
        from: 'tasks',
        localField: '_id',
        foreignField: '_id',
        as: 'task',
      })
      .replaceRoot({
        $mergeObjects: [{ $first: '$task' }, { visits: '$visits' }],
      })
      .sort({ title: 'asc' })
      .exec();

    const results = {
      dateRange,
      dateRangeData: tasksData,
    };

    await this.cacheManager.set(cacheKey, results);

    return results;
  }

  async getTaskDetails(params: ApiParams): Promise<TaskDetailsData> {
    if (!params.id) {
      throw Error(
        'Attempted to get Task details from API but no id was provided.'
      );
    }

    const cacheKey = `getTaskDetails-${params.id}-${params.dateRange}-${params.comparisonDateRange}`;
    const cachedData = await this.cacheManager.store.get<TaskDetailsData>(
      cacheKey
    );

    if (cachedData) {
      return cachedData;
    }

    const task = await this.taskModel
      .findById(new Types.ObjectId(params.id), {
        airtable_id: 0,
        user_type: 0,
      })
      .populate('pages')
      .populate('ux_tests');

    const taskUrls = task.pages
      .map((page) => ('url' in page && page.url) || '')
      .filter((url) => !!url);

    const returnData: TaskDetailsData = {
      _id: task._id.toString(),
      title: task.title,
      dateRange: params.dateRange,
      dateRangeData: await getTaskAggregatedData(
        this.pageMetricsModel,
        params.dateRange,
        taskUrls
      ),
      comparisonDateRange: params.comparisonDateRange,
      comparisonDateRangeData: await getTaskAggregatedData(
        this.pageMetricsModel,
        params.comparisonDateRange,
        taskUrls
      ),
      taskSuccessByUxTest: [],
      avgTaskSuccessFromLastTest: 1, // todo: better handle N/A
      dateFromLastTest: new Date(),
    };

    if (task.ux_tests && task.ux_tests.length !== 0) {
      returnData.taskSuccessByUxTest = task.ux_tests
        .map(
          (uxTest) =>
            typeof uxTest === 'object' && {
              title: uxTest.title,
              date: uxTest.date,
              testType: uxTest.test_type,
              successRate: uxTest.success_rate,
              totalUsers: uxTest.total_users,
            }
        )
        .filter((uxTest) => !!uxTest);

      // todo: aggregate projects instead of single test
      const lastUxTest = task.ux_tests.sort(
        (current, next) => next.date.getTime() - current.date.getTime()
      )[0];

      returnData.avgTaskSuccessFromLastTest =
        'success_rate' in lastUxTest ? lastUxTest.success_rate : 1; // todo: better handle nulls

      returnData.dateFromLastTest =
        'date' in lastUxTest ? lastUxTest.date : new Date(); // todo: better handle nulls
    }

    await this.cacheManager.set(cacheKey, returnData);

    return returnData;
  }
}

async function getTaskAggregatedData(
  pageMetricsModel: PageMetricsModel,
  dateRange: string,
  pageUrls: string[]
): Promise<Omit<TaskDetailsAggregatedData, 'avgTaskSuccess'>> {
  const [startDate, endDate] = dateRange.split('/').map((d) => new Date(d));

  const results = await pageMetricsModel
    .aggregate<TaskDetailsAggregatedData>()
    .sort({ date: -1, url: 1 })
    .match({
      date: { $gte: startDate, $lte: endDate },
      url: { $in: pageUrls },
    })
    .group({
      _id: '$url',
      page: { $first: '$page' },
      visits: { $sum: '$visits' },
      dyfYes: { $sum: '$dyf_yes' },
      dyfNo: { $sum: '$dyf_no' },
      fwylfCantFindInfo: { $sum: '$fwylf_cant_find_info' },
      fwylfError: { $sum: '$fwylf_error' },
      fwylfHardToUnderstand: { $sum: '$fwylf_hard_to_understand' },
      fwylfOther: { $sum: '$fwylf_other' },
      gscTotalClicks: { $sum: '$gsc_total_clicks' },
      gscTotalImpressions: { $sum: '$gsc_total_impressions' },
      gscTotalCtr: { $avg: '$gsc_total_ctr' },
      gscTotalPosition: { $avg: '$gsc_total_position' },
    })
    .lookup({
      from: 'pages',
      localField: 'page',
      foreignField: '_id',
      as: 'page',
    })
    .unwind('$page')
    .replaceRoot({
      $mergeObjects: [
        '$$ROOT',
        { _id: '$page._id', title: '$page.title', url: '$page.url' },
      ],
    })
    // .addFields({ _id: '$page' })
    .project({ page: 0 })
    .sort( { title: 1 })
    .group({
      _id: 'null',
      visits: { $sum: '$visits' },
      dyfYes: { $sum: '$dyfYes' },
      dyfNo: { $sum: '$dyfNo' },
      fwylfCantFindInfo: { $sum: '$fwylfCantFindInfo' },
      fwylfError: { $sum: '$fwylfError' },
      fwylfHardToUnderstand: { $sum: '$fwylfHardToUnderstand' },
      fwylfOther: { $sum: '$fwylfOther' },
      gscTotalClicks: { $sum: '$gscTotalClicks' },
      gscTotalImpressions: { $sum: '$gscTotalImpressions' },
      gscTotalCtr: { $avg: '$gscTotalCtr' },
      gscTotalPosition: { $avg: '$gscTotalPosition' },
      visitsByPage: { $push: '$$ROOT' },
    })
    .project({ _id: 0 })
    .exec();

  return results[0];
}
