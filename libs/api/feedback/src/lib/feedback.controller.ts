import { Controller, Get, Query } from '@nestjs/common';
import { FeedbackParams, FeedbackService } from './feedback.service';
import { logJson, parseDateRangeString } from '@dua-upd/utils-common';

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Get('most-relevant')
  async mostRelevant(
    @Query('dateRange') dateRangeString: string,
    @Query('type') type?: 'page' | 'task' | 'project',
    @Query('id') id?: string,
    @Query('normalizationStrength', { transform: Number })
    normalizationStrength?: number,
  ) {
    const params: FeedbackParams = {
      dateRange: parseDateRangeString(dateRangeString),
      type,
      id,
      normalizationStrength,
    };

    logJson(params);

    return await this.feedbackService.getMostRelevantCommentsAndWords(params);
  }
}
