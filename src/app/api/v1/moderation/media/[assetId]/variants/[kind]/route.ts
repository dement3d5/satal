import {
  getModerationMediaVariant,
  type ModerationVariantKind
} from '@/modules/moderation/media-service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{assetId: string; kind: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    const variant = await getModerationMediaVariant(
      getDatabase(),
      actorId,
      parseUuid(params.assetId, 'assetId'),
      parseKind(params.kind)
    );
    return new Response(variant.bytes as BodyInit, {
      headers: {
        'cache-control': 'private, no-store',
        'content-type': variant.mediaType,
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function parseKind(value: string): ModerationVariantKind {
  if (value === 'thumbnail' || value === 'detail') return value;
  throw new AppError('NOT_FOUND', 'Media variant was not found', 404);
}
