import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  GscSearchTermMetrics,
  AASearchTermMetrics,
  ActivityMapMetrics,
} from '@dua-upd/types-common';

export type PageMetricsTSDocument = PageMetricsTS & Document;

export interface PageMetricsMeta {
  url: string;
  page?: Types.ObjectId;
  projects?: Types.ObjectId[];
  tasks?: Types.ObjectId[];
  ux_tests?: Types.ObjectId[];
}

@Schema({
  collection: 'page_metrics_ts',
  timeseries: {
    granularity: 'hours',
    metaField: 'meta',
    timeField: 'date',
  },
})
export class PageMetricsTS {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({
    type: {
      url: String,
      page: { type: Types.ObjectId, ref: 'Page' },
      projects: [{ type: Types.ObjectId, ref: 'Project' }],
      tasks: [{ type: Types.ObjectId, ref: 'Task' }],
      ux_tests: [{ type: Types.ObjectId, ref: 'UxTest' }],
    },
  })
  meta: PageMetricsMeta;

  @Prop({ required: true, type: Date })
  date = new Date(0);

  @Prop({ type: Number })
  dyf_submit = 0;

  @Prop({ type: Number })
  dyf_yes = 0;

  @Prop({ type: Number })
  dyf_no = 0;

  @Prop({ type: Number })
  views = 0;

  @Prop({ type: Number })
  visits = 0;

  @Prop({ type: Number })
  visitors = 0;

  @Prop({ type: Number })
  average_time_spent = 0;

  @Prop({ type: Number })
  bouncerate = 0;

  @Prop({ type: Number })
  rap_initiated = 0;

  @Prop({ type: Number })
  rap_completed = 0;

  @Prop({ type: Number })
  nav_menu_initiated = 0;

  @Prop({ type: Number })
  rap_cant_find = 0;

  @Prop({ type: Number })
  rap_login_error = 0;

  @Prop({ type: Number })
  rap_other = 0;

  @Prop({ type: Number })
  rap_sin = 0;

  @Prop({ type: Number })
  rap_info_missing = 0;

  @Prop({ type: Number })
  rap_securekey = 0;

  @Prop({ type: Number })
  rap_other_login = 0;

  @Prop({ type: Number })
  rap_gc_key = 0;

  @Prop({ type: Number })
  rap_info_wrong = 0;

  @Prop({ type: Number })
  rap_spelling = 0;

  @Prop({ type: Number })
  rap_access_code = 0;

  @Prop({ type: Number })
  rap_link_not_working = 0;

  @Prop({ type: Number })
  rap_404 = 0;

  @Prop({ type: Number })
  rap_blank_form = 0;

  @Prop({ type: Number })
  fwylf_cant_find_info = 0;

  @Prop({ type: Number })
  fwylf_other = 0;

  @Prop({ type: Number })
  fwylf_hard_to_understand = 0;

  @Prop({ type: Number })
  fwylf_error = 0;

  @Prop({ type: Number })
  visits_geo_ab = 0;

  @Prop({ type: Number })
  visits_geo_bc = 0;

  @Prop({ type: Number })
  visits_geo_mb = 0;

  @Prop({ type: Number })
  visits_geo_nb = 0;

  @Prop({ type: Number })
  visits_geo_nl = 0;

  @Prop({ type: Number })
  visits_geo_ns = 0;

  @Prop({ type: Number })
  visits_geo_nt = 0;

  @Prop({ type: Number })
  visits_geo_nu = 0;

  @Prop({ type: Number })
  visits_geo_on = 0;

  @Prop({ type: Number })
  visits_geo_outside_canada = 0;

  @Prop({ type: Number })
  visits_geo_pe = 0;

  @Prop({ type: Number })
  visits_geo_qc = 0;

  @Prop({ type: Number })
  visits_geo_sk = 0;

  @Prop({ type: Number })
  visits_geo_us = 0;

  @Prop({ type: Number })
  visits_geo_yt = 0;

  @Prop({ type: Number })
  visits_referrer_other = 0;

  @Prop({ type: Number })
  visits_referrer_searchengine = 0;

  @Prop({ type: Number })
  visits_referrer_social = 0;

  @Prop({ type: Number })
  visits_referrer_typed_bookmarked = 0;

  @Prop({ type: Number })
  visits_device_other = 0;

  @Prop({ type: Number })
  visits_device_desktop = 0;

  @Prop({ type: Number })
  visits_device_mobile = 0;

  @Prop({ type: Number })
  visits_device_tablet = 0;

  @Prop({ type: Number })
  gsc_total_clicks = 0;

  @Prop({ type: Number })
  gsc_total_ctr = 0;

  @Prop({ type: Number })
  gsc_total_impressions = 0;

  @Prop({ type: Number })
  gsc_total_position = 0;

  @Prop({
    type: [
      {
        clicks: Number,
        ctr: Number,
        impressions: Number,
        position: Number,
        term: String,
      },
    ],
  })
  gsc_searchterms?: GscSearchTermMetrics[];

  @Prop({ type: [{ term: String, clicks: Number, position: Number }] })
  aa_searchterms?: AASearchTermMetrics[];

  @Prop({
    type: [
      {
        link: String,
        clicks: Number,
      },
    ],
  })
  activity_map?: ActivityMapMetrics[] = [];
}

export const PageMetricsTSSchema = SchemaFactory.createForClass(PageMetricsTS);

PageMetricsTSSchema.index(
  { date: -1, 'meta.url': 1 },
  { background: true, unique: true }
);
PageMetricsTSSchema.index(
  { date: -1, 'meta.page': 1 },
  {
    background: true,
    partialFilterExpression: { 'meta.page': { $exists: true } },
  }
);
PageMetricsTSSchema.index(
  { date: -1, 'meta.projects': 1 },
  {
    background: true,
    partialFilterExpression: { 'meta.projects': { $exists: true } },
  }
);
PageMetricsTSSchema.index(
  { date: -1, 'meta.tasks': 1 },
  {
    background: true,
    partialFilterExpression: { 'meta.tasks': { $exists: true } },
  }
);
PageMetricsTSSchema.index(
  { date: -1, 'meta.ux_tests': 1 },
  {
    background: true,
    partialFilterExpression: { 'meta.ux_tests': { $exists: true } },
  }
);
