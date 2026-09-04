import {NextResponse} from 'next/server';

import {addFavorite, getFavoriteStatus, removeFavorite} from '@/modules/engagement/service';
import {getDatabase} from '@/server/db/client';
import {errorResponse} from '@/server/errors/http';
import {parseUuid} from '@/server/http/params';
import {requestIdFrom, requireActorId} from '@/server/http/request-context';

type Context = {params: Promise<{listingId: string}>};

export async function GET(request: Request, context: Context) {
  return handle(request, context, 'get');
}

export async function PUT(request: Request, context: Context) {
  return handle(request, context, 'put');
}

export async function DELETE(request: Request, context: Context) {
  return handle(request, context, 'delete');
}

async function handle(request: Request, context: Context, action: 'get' | 'put' | 'delete') {
  const requestId = requestIdFrom(request);
  try {
    const actorId = await requireActorId(request.headers);
    const listingId = parseUuid((await context.params).listingId, 'listingId');
    const db = getDatabase();
    const data =
      action === 'put'
        ? await addFavorite(db, actorId, listingId)
        : action === 'delete'
          ? await removeFavorite(db, actorId, listingId)
          : await getFavoriteStatus(db, actorId, listingId);
    const response = NextResponse.json({data});
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    return errorResponse(error, requestId);
  }
}
