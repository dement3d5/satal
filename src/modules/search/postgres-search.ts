import {and, asc, count, desc, eq, sql, type SQL} from 'drizzle-orm';

import type {DatabaseClient} from '@/server/db/client';
import {listing} from '@/server/db/schema';

import type {SearchQuery} from './contracts';
import type {SearchPage} from './gateway';

export async function searchPostgres(db: DatabaseClient, query: SearchQuery): Promise<SearchPage> {
  const conditions: SQL[] = [eq(listing.status, 'active')];
  if (query.q) {
    conditions.push(sql`
      to_tsvector('simple', coalesce(${listing.title}, '') || ' ' || coalesce(${listing.description}, ''))
      @@ websearch_to_tsquery('simple', ${query.q})
    `);
  }
  if (query.categoryId) {
    conditions.push(sql`${listing.categoryId} in (
      with recursive category_scope as (
        select id from category where id = ${query.categoryId}
        union all
        select child.id from category child join category_scope parent on child.parent_id = parent.id
      ) select id from category_scope
    )`);
  }
  if (query.locationId) {
    conditions.push(sql`${listing.locationId} in (
      with recursive location_scope as (
        select id from location where id = ${query.locationId}
        union all
        select child.id from location child join location_scope parent on child.parent_id = parent.id
      ) select id from location_scope
    )`);
  }
  if (query.priceMinMinor !== undefined) {
    conditions.push(sql`${listing.priceMinor} >= ${query.priceMinMinor}`);
  }
  if (query.priceMaxMinor !== undefined) {
    conditions.push(sql`${listing.priceMinor} <= ${query.priceMaxMinor}`);
  }
  for (const filter of query.filters) conditions.push(toFilterCondition(filter));

  const where = and(...conditions);
  const order = searchOrder(query);
  const [rows, totalRows] = await Promise.all([
    db
      .select({id: listing.id})
      .from(listing)
      .where(where)
      .orderBy(...order)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit),
    db.select({value: count()}).from(listing).where(where)
  ]);
  return {ids: rows.map((row) => row.id), total: totalRows[0]?.value ?? 0};
}

function toFilterCondition(filter: SearchQuery['filters'][number]): SQL {
  if (filter.type === 'options') {
    const optionIds = sql.join(
      filter.optionIds.map((optionId) => sql`${optionId}`),
      sql`, `
    );
    return sql`(
      exists (
        select 1 from listing_attribute_value value
        where value.listing_id = ${listing.id}
          and value.attribute_id = ${filter.attributeId}
          and value.option_id in (${optionIds})
      ) or exists (
        select 1 from listing_attribute_option_value value
        where value.listing_id = ${listing.id}
          and value.attribute_id = ${filter.attributeId}
          and value.option_id in (${optionIds})
      )
    )`;
  }
  if (filter.type === 'boolean') {
    return sql`exists (
      select 1 from listing_attribute_value value
      where value.listing_id = ${listing.id}
        and value.attribute_id = ${filter.attributeId}
        and value.boolean_value = ${filter.value}
    )`;
  }
  const numericValue = sql`coalesce(value.decimal_value, value.integer_value::numeric)`;
  return sql`exists (
    select 1 from listing_attribute_value value
    where value.listing_id = ${listing.id}
      and value.attribute_id = ${filter.attributeId}
      ${filter.min !== undefined ? sql`and ${numericValue} >= ${filter.min}` : sql``}
      ${filter.max !== undefined ? sql`and ${numericValue} <= ${filter.max}` : sql``}
  )`;
}

function searchOrder(query: SearchQuery): SQL[] {
  if (query.sort === 'price_asc') return [asc(listing.priceMinor), desc(listing.publishedAt)];
  if (query.sort === 'price_desc') return [desc(listing.priceMinor), desc(listing.publishedAt)];
  if (query.sort === 'relevance' && query.q) {
    return [
      desc(
        sql`ts_rank(
          to_tsvector('simple', coalesce(${listing.title}, '') || ' ' || coalesce(${listing.description}, '')),
          websearch_to_tsquery('simple', ${query.q})
        )`
      ),
      desc(listing.publishedAt)
    ];
  }
  return [desc(listing.publishedAt), desc(listing.id)];
}
