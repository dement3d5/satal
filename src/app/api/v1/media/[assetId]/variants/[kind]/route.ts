import {getPublicMediaVariant, type PublicVariantKind} from '@/modules/media/public-media-service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom} from '@/server/http/request-context';

type Context = {params: Promise<{assetId: string; kind: string}>};

export async function GET(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const params = await context.params;
    const kind = parseKind(params.kind);
    const variant = await getPublicMediaVariant(
      getDatabase(),
      parseUuid(params.assetId, 'assetId'),
      kind
    );
    return new Response(variant.bytes as BodyInit, {
      headers: {
        'cache-control': 'public, max-age=31536000, immutable',
        'content-type': variant.mediaType,
        'x-content-type-options': 'nosniff'
      }
    });
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function parseKind(value: string): PublicVariantKind {
  if (value === 'thumbnail' || value === 'card' || value === 'detail') return value;
  throw new AppError('NOT_FOUND', 'Media variant was not found', 404);
}
