import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import {
  listPublicReleases,
  getPublicRelease,
  listInternalReleases,
  getInternalRelease,
  getVersionTimeline,
} from './release.service.js';

// ── Public (What's New) ──────────────────────────────────────────────────

export const listPublicReleasesController = catchAsync(async (req, res) => {
  const releases = listPublicReleases({ q: req.query.q });
  sendSuccess(res, StatusCodes.OK, 'Releases fetched successfully', releases);
});

export const getPublicReleaseController = catchAsync(async (req, res) => {
  const release = getPublicRelease(req.params.version);
  if (!release) {
    return res.status(StatusCodes.NOT_FOUND).json({ status: 'fail', message: 'Release not found' });
  }
  sendSuccess(res, StatusCodes.OK, 'Release fetched successfully', release);
});

export const getTimelineController = catchAsync(async (req, res) => {
  // Version history / feature timeline — released versions only for the public.
  const timeline = getVersionTimeline().filter((r) => r.status === 'released');
  sendSuccess(res, StatusCodes.OK, 'Version timeline fetched successfully', timeline);
});

// ── Internal (superadmin release dashboard) ──────────────────────────────

export const listInternalReleasesController = catchAsync(async (req, res) => {
  const releases = listInternalReleases({
    q: req.query.q,
    status: req.query.status,
    sprint: req.query.sprint,
  });
  sendSuccess(res, StatusCodes.OK, 'Internal releases fetched successfully', releases);
});

export const getInternalReleaseController = catchAsync(async (req, res) => {
  const release = getInternalRelease(req.params.version);
  if (!release) {
    return res.status(StatusCodes.NOT_FOUND).json({ status: 'fail', message: 'Release not found' });
  }
  sendSuccess(res, StatusCodes.OK, 'Internal release fetched successfully', release);
});
