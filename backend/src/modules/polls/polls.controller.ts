import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dto/create-poll.dto';
import { SubmitVoteDto } from './dto/submit-vote.dto';
import { QueryPollsDto } from './dto/query-polls.dto';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('polls')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Get('academic-scopes')
  getAcademicScopes() {
    return this.pollsService.getAcademicScopes();
  }

  @Get()
  getPolls(@Req() req: any, @Query() query: QueryPollsDto) {
    return this.pollsService.getPolls(req.user.id, query);
  }

  @Post()
  createPoll(@Req() req: any, @Body() dto: CreatePollDto) {
    return this.pollsService.createPoll(req.user.id, dto);
  }

  @Get(':id')
  getPollById(@Req() req: any, @Param('id') id: string) {
    return this.pollsService.getPollById(req.user.id, id);
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  submitVote(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitVoteDto,
  ) {
    return this.pollsService.submitVote(req.user.id, id, dto);
  }

  @Get(':id/voters')
  getVoterReport(@Req() req: any, @Param('id') id: string) {
    return this.pollsService.getVoterReport(req.user.id, id);
  }

  @Delete(':id')
  deletePoll(@Req() req: any, @Param('id') id: string) {
    return this.pollsService.deletePoll(req.user.id, id);
  }

  @Post('purge-expired')
  @HttpCode(HttpStatus.OK)
  purgeExpiredPolls() {
    return this.pollsService.purgeExpiredPolls();
  }
}

