import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { model, Document, Types } from 'mongoose';
import { UxTest } from './ux-test.schema';
import { Page } from './page.schema';
import { Project } from './project.schema';
import { ITask } from '@dua-upd/types-common';

export type TaskDocument = Task & Document;

@Schema()
export class Task implements ITask {
  @Prop({ type: Types.ObjectId, required: true })
  _id: Types.ObjectId = new Types.ObjectId();

  @Prop({ required: true, unique: true, type: String, index: true })
  airtable_id = '';

  @Prop({ required: true, type: String })
  title = '';

  @Prop({ type: String })
  group = '';

  @Prop({ type: String })
  subgroup = '';

  @Prop({ type: String })
  topic = '';

  @Prop({ type: String })
  subtopic = '';

  @Prop({ type: [String] })
  sub_subtopic: string[] = [];

  @Prop({ type: [String] })
  user_type: string[] = [];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'UxTest' }] })
  ux_tests?: Types.ObjectId[] | UxTest[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Project' }] })
  projects?: Types.ObjectId[] | Project[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Page' }] })
  pages?: Types.ObjectId[] | Page[];

  @Prop({ type: [Number] })
  tpc_ids: number[] = [];

  @Prop({ type: String })
  program = '';

  @Prop({ type: String })
  service = '';

  @Prop({ type: [String] })
  user_journey: string[] = [];

  @Prop({ type: String })
  status = '';

  @Prop({ type: [String] })
  channel: string[] = [];

  @Prop({ type: [String] })
  core: string[] = [];
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ tasks: 1, date: 1 });

export const taskModel = model(Task.name, TaskSchema);

export function getTaskModel() {
  return taskModel;
}
