import {NextResponse} from 'next/server';

import {authorizeMediaUploadSchema} from '@/modules/media/contracts';
import {shopMediaKindSchema} from '@/modules/shops/contracts';
import {authorizeShopMediaUpload, removeShopMedia} from '@/modules/shops/media-service';
import {getDatabase} from '@/server/db/client';
import {AppError} from '@/server/errors/app-error';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';
import {parseJson} from '@/server/http/validation';

type Context = {params: Promise<{shopId: string; kind: string}>};

export async function POST(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    const shopId = parseUuid(params.shopId, 'shopId');
    const kind = parseKind(params.kind);
    const input = await parseJson(request, authorizeMediaUploadSchema);
    const response = NextResponse.json(
      {data: await authorizeShopMediaUpload(getDatabase(), actorId, shopId, kind, input)},
      {status: 201}
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

export async function DELETE(request: Request, context: Context) {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const params = await context.params;
    const shopId = parseUuid(params.shopId, 'shopId');
    const kind = parseKind(params.kind);
    await removeShopMedia(getDatabase(), actorId, shopId, kind);
    return new NextResponse(null, {status: 204});
  } catch (error) {
    return errorResponse(error, requestId);
  }
}

function parseKind(value: string) {
  const result = shopMediaKindSchema.safeParse(value);
  if (!result.success) throw new AppError('BAD_REQUEST', 'Shop media kind is invalid', 400);
  return result.data;
}
