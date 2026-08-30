'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import type {
  CategoryAttributeContract,
  CategoryNodeContract,
  CategorySchemaContract,
  ContractLocale
} from '@/modules/catalog/contracts';
import type {LocationContract} from '@/modules/geography/contracts';
import type {DraftAttributeInput} from '@/modules/listings/draft-contracts';

import {
  collectAttributeValues,
  findCategoryPath,
  hasAttributeValue,
  type AttributeState
} from './listing-form-model';

type Step = 'category' | 'details' | 'location' | 'review';
type SaveState = 'local' | 'saving' | 'saved' | 'error';

interface DraftSnapshot {
  id: string;
  version: number;
  categoryId: string;
}

interface ApiErrorShape {
  error?: {code?: string; message?: string};
}

export function ListingCreation() {
  const t = useTranslations('sell');
  const locale = useLocale() as ContractLocale;
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<CategoryNodeContract[]>([]);
  const [categoryPath, setCategoryPath] = useState<CategoryNodeContract[]>([]);
  const [schema, setSchema] = useState<CategorySchemaContract | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [attributes, setAttributes] = useState<AttributeState>({});
  const [locationTrail, setLocationTrail] = useState<LocationContract[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationContract[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('local');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const dirtyRevision = useRef(0);
  const savedRevision = useRef(0);
  const saving = useRef(false);

  const selectedCategory = categoryPath.at(-1);
  const categoryChoices = selectedCategory ? selectedCategory.children : categories;

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    setCategoryError(null);
    try {
      const response = await fetch(`/api/v1/catalog/categories?locale=${locale}`);
      const body = (await response.json()) as {data?: CategoryNodeContract[]} & ApiErrorShape;
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('loadError'));
      setCategories(body.data);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : t('loadError'));
    } finally {
      setLoadingCategories(false);
    }
  }, [locale, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCategories(), 0);
    return () => window.clearTimeout(timer);
  }, [loadCategories]);

  const loadSchema = useCallback(
    async (category: CategoryNodeContract) => {
      setLoadingSchema(true);
      setCategoryError(null);
      try {
        const response = await fetch(
          `/api/v1/catalog/categories/${category.id}/schema?locale=${locale}`
        );
        const body = (await response.json()) as {data?: CategorySchemaContract} & ApiErrorShape;
        if (!response.ok || !body.data) throw new Error(body.error?.message || t('schemaError'));
        setSchema(body.data);
      } catch (error) {
        setCategoryError(error instanceof Error ? error.message : t('schemaError'));
      } finally {
        setLoadingSchema(false);
      }
    },
    [locale, t]
  );

  async function chooseCategory(category: CategoryNodeContract) {
    if (category.children.length) {
      const existingIndex = categoryPath.findIndex((item) => item.id === category.id);
      setCategoryPath(
        existingIndex >= 0 ? categoryPath.slice(0, existingIndex + 1) : [...categoryPath, category]
      );
      setSchema(null);
      return;
    }

    const path = findCategoryPath(categories, category.id);
    setCategoryPath(path.length ? path : [...categoryPath, category]);
    if (draft && draft.categoryId !== category.id) {
      try {
        const response = await fetch(`/api/v1/listing-drafts/${draft.id}/category`, {
          method: 'PUT',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({version: draft.version, categoryId: category.id})
        });
        const body = (await response.json()) as {
          data?: {draft: DraftSnapshot; removedAttributeIds: string[]};
        } & ApiErrorShape;
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message || t('categoryChangeError'));
        }
        setDraft(body.data.draft);
        setAttributes({});
        setSaveState('saved');
      } catch (error) {
        setCategoryError(error instanceof Error ? error.message : t('categoryChangeError'));
        return;
      }
    }
    await loadSchema(category);
  }

  async function beginDetails() {
    if (!schema) return;
    setAuthRequired(false);
    if (!draft) {
      try {
        const response = await fetch('/api/v1/listing-drafts', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({categoryId: schema.category.id})
        });
        const body = (await response.json()) as {data?: DraftSnapshot} & ApiErrorShape;
        if (response.status === 401) {
          setAuthRequired(true);
          setSaveState('local');
        } else if (!response.ok || !body.data) {
          throw new Error(body.error?.message || t('draftError'));
        } else {
          setDraft(body.data);
          setSaveState('saved');
        }
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : t('draftError'));
        setSaveState('error');
      }
    }
    setStep('details');
  }

  function markDirty() {
    dirtyRevision.current += 1;
    setSaveState(draft ? 'saving' : 'local');
  }

  const saveDraft = useCallback(async () => {
    if (!draft || saving.current || dirtyRevision.current === savedRevision.current) return;
    saving.current = true;
    const revision = dirtyRevision.current;
    setSaveState('saving');
    setSaveError(null);
    try {
      const response = await fetch(`/api/v1/listing-drafts/${draft.id}`, {
        method: 'PATCH',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          version: draft.version,
          title,
          description,
          priceMinor: price === '' ? null : Math.round(Number(price) * 100),
          locationId,
          publicLocationPrecision: precisionFor(locationTrail.at(-1)),
          attributes: collectAttributeValues(attributes)
        })
      });
      const body = (await response.json()) as {data?: DraftSnapshot} & ApiErrorShape;
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('saveError'));
      setDraft(body.data);
      savedRevision.current = revision;
      setSaveState('saved');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('saveError'));
      setSaveState('error');
    } finally {
      saving.current = false;
    }
  }, [attributes, description, draft, locationId, locationTrail, price, t, title]);

  useEffect(() => {
    if (!draft || dirtyRevision.current === savedRevision.current) return;
    const timer = window.setTimeout(() => void saveDraft(), 850);
    return () => window.clearTimeout(timer);
  }, [draft, saveDraft, title, description, price, attributes, locationId]);

  async function publishDraft() {
    if (!draft || saveState !== 'saved') return;
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch(`/api/v1/listing-drafts/${draft.id}/publish`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({version: draft.version})
      });
      const body = (await response.json()) as {data?: {id: string}} & ApiErrorShape;
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('publishError'));
      window.location.assign(`/${locale}/listings/${body.data.id}`);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : t('publishError'));
      setPublishing(false);
    }
  }

  async function loadLocations(parentId: string | null, trail: LocationContract[]) {
    setLoadingLocations(true);
    try {
      const query = new URLSearchParams({locale});
      if (parentId) query.set('parentId', parentId);
      const response = await fetch(`/api/v1/locations?${query}`);
      const body = (await response.json()) as {data?: LocationContract[]} & ApiErrorShape;
      if (!response.ok || !body.data) throw new Error(body.error?.message || t('locationError'));
      setLocationTrail(trail);
      setLocationOptions(body.data);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('locationError'));
    } finally {
      setLoadingLocations(false);
    }
  }

  useEffect(() => {
    if (step === 'location' && locationOptions.length === 0 && locationTrail.length === 0) {
      const timer = window.setTimeout(() => void loadLocations(null, []), 0);
      return () => window.clearTimeout(timer);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function chooseLocation(location: LocationContract) {
    const nextTrail = [...locationTrail, location];
    if (isPublicLocation(location)) {
      setLocationId(location.id);
      markDirty();
    }
    await loadLocations(location.id, nextTrail);
  }

  const requiredMissing = useMemo(
    () =>
      schema?.attributes.filter(
        (attribute) => attribute.required && !hasAttributeValue(attributes[attribute.id])
      ) ?? [],
    [attributes, schema]
  );

  return (
    <div className="sell-shell">
      <aside className="sell-intro">
        <p className="eyebrow">
          <span aria-hidden="true" />
          {t('eyebrow')}
        </p>
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <ol className="step-list">
          {(['category', 'details', 'location', 'review'] as const).map((item, index) => (
            <li
              className={step === item ? 'is-current' : stepIndex(step) > index ? 'is-done' : ''}
              key={item}
            >
              <span>{stepIndex(step) > index ? '✓' : index + 1}</span>
              <div>
                <strong>{t(`steps.${item}`)}</strong>
                <small>{t(`stepHints.${item}`)}</small>
              </div>
            </li>
          ))}
        </ol>
        <div className={`save-indicator save-${saveState}`} role="status">
          <span aria-hidden="true" />
          {saveState === 'saved' && t('saved')}
          {saveState === 'saving' && t('saving')}
          {saveState === 'local' && t('localOnly')}
          {saveState === 'error' && (saveError || t('saveError'))}
        </div>
      </aside>

      <section className="sell-card" aria-labelledby="sell-step-title">
        <div className="mobile-progress" aria-hidden="true">
          <span style={{width: `${(stepIndex(step) + 1) * 25}%`}} />
        </div>
        {step === 'category' && (
          <CategoryStep
            categories={categoryChoices}
            categoryPath={categoryPath}
            error={categoryError}
            loading={loadingCategories || loadingSchema}
            onBack={() => {
              setCategoryPath(categoryPath.slice(0, -1));
              setSchema(null);
            }}
            onChoose={(category) => void chooseCategory(category)}
            onContinue={() => void beginDetails()}
            onRetry={() => void loadCategories()}
            schema={schema}
            t={t}
          />
        )}

        {step === 'details' && schema && (
          <DetailsStep
            attributes={attributes}
            authRequired={authRequired}
            description={description}
            onAttribute={(id, value) => {
              setAttributes((current) => ({...current, [id]: value}));
              markDirty();
            }}
            onBack={() => setStep('category')}
            onDescription={(value) => {
              setDescription(value);
              markDirty();
            }}
            onNext={() => setStep('location')}
            onPrice={(value) => {
              setPrice(value);
              markDirty();
            }}
            onTitle={(value) => {
              setTitle(value);
              markDirty();
            }}
            price={price}
            schema={schema}
            t={t}
            title={title}
          />
        )}

        {step === 'location' && (
          <LocationStep
            loading={loadingLocations}
            locationId={locationId}
            options={locationOptions}
            onBack={() => setStep('details')}
            onChoose={(location) => void chooseLocation(location)}
            onTrailBack={(index) => {
              const parent = index < 0 ? null : (locationTrail[index]?.id ?? null);
              void loadLocations(parent, locationTrail.slice(0, index + 1));
            }}
            onNext={() => setStep('review')}
            t={t}
            trail={locationTrail}
          />
        )}

        {step === 'review' && schema && (
          <ReviewStep
            canPublish={
              Boolean(draft) &&
              saveState === 'saved' &&
              requiredMissing.length === 0 &&
              Boolean(locationId)
            }
            category={schema.category.name}
            location={locationTrail.at(-1)?.name ?? t('notSelected')}
            missing={requiredMissing.map((item) => item.label)}
            onBack={() => setStep('location')}
            onEdit={() => setStep('details')}
            onPublish={() => void publishDraft()}
            price={price}
            publishError={publishError}
            publishing={publishing}
            t={t}
            title={title}
          />
        )}
      </section>
    </div>
  );
}

type Translator = ReturnType<typeof useTranslations<'sell'>>;

function CategoryStep(props: {
  categories: CategoryNodeContract[];
  categoryPath: CategoryNodeContract[];
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onChoose: (category: CategoryNodeContract) => void;
  onContinue: () => void;
  onRetry: () => void;
  schema: CategorySchemaContract | null;
  t: Translator;
}) {
  const {t} = props;
  return (
    <>
      <StepHeader number="01" title={t('categoryTitle')} text={t('categoryText')} />
      {props.categoryPath.length > 0 && (
        <div className="selection-path">
          {props.categoryPath.map((item) => (
            <span key={item.id}>{item.name}</span>
          ))}
        </div>
      )}
      {props.error && (
        <ErrorState message={props.error} action={t('retry')} onAction={props.onRetry} />
      )}
      {props.loading ? (
        <SkeletonList />
      ) : props.schema ? (
        <div className="selected-category">
          <CheckIcon />
          <div>
            <strong>{props.schema.category.name}</strong>
            <span>{t('categorySelected')}</span>
          </div>
        </div>
      ) : (
        <div className="choice-grid">
          {props.categories.map((category) => (
            <button
              className="choice-card"
              key={category.id}
              onClick={() => props.onChoose(category)}
              type="button"
            >
              <CategoryGlyph slug={category.slug} />
              <span>
                <strong>{category.name}</strong>
                <small>
                  {category.children.length
                    ? t('subcategories', {count: category.children.length})
                    : t('readyCategory')}
                </small>
              </span>
              <ChevronIcon />
            </button>
          ))}
        </div>
      )}
      <div className="form-actions">
        <button
          className="button button-ghost"
          disabled={props.categoryPath.length === 0}
          onClick={props.onBack}
          type="button"
        >
          {t('back')}
        </button>
        <button
          className="button button-primary"
          disabled={!props.schema || props.loading}
          onClick={props.onContinue}
          type="button"
        >
          {t('continue')}
        </button>
      </div>
    </>
  );
}

function DetailsStep(props: {
  attributes: AttributeState;
  authRequired: boolean;
  description: string;
  onAttribute: (id: string, value: DraftAttributeInput | undefined) => void;
  onBack: () => void;
  onDescription: (value: string) => void;
  onNext: () => void;
  onPrice: (value: string) => void;
  onTitle: (value: string) => void;
  price: string;
  schema: CategorySchemaContract;
  t: Translator;
  title: string;
}) {
  const {t} = props;
  return (
    <>
      <StepHeader number="02" title={t('detailsTitle')} text={t('detailsText')} />
      {props.authRequired && (
        <div className="notice notice-warm">
          <LockIcon />
          <div>
            <strong>{t('authTitle')}</strong>
            <p>{t('authText')}</p>
          </div>
        </div>
      )}
      <div className="form-grid">
        <label className="field field-wide">
          <span>
            {t('listingTitle')} <b>*</b>
          </span>
          <input
            maxLength={180}
            value={props.title}
            onChange={(event) => props.onTitle(event.target.value)}
            placeholder={t('listingTitlePlaceholder')}
          />
          <small>{props.title.length}/180</small>
        </label>
        <label className="field">
          <span>{t('price')}</span>
          <div className="input-suffix">
            <input
              min="0"
              inputMode="decimal"
              type="number"
              value={props.price}
              onChange={(event) => props.onPrice(event.target.value)}
              placeholder="0"
            />
            <strong>AZN</strong>
          </div>
        </label>
        <label className="field field-wide">
          <span>{t('listingDescription')}</span>
          <textarea
            maxLength={20000}
            rows={5}
            value={props.description}
            onChange={(event) => props.onDescription(event.target.value)}
            placeholder={t('descriptionPlaceholder')}
          />
        </label>
        {props.schema.attributes.map((attribute) => (
          <DynamicField
            attribute={attribute}
            key={attribute.id}
            onChange={(value) => props.onAttribute(attribute.id, value)}
            t={t}
            value={props.attributes[attribute.id]}
          />
        ))}
      </div>
      <div className="form-actions">
        <button className="button button-ghost" onClick={props.onBack} type="button">
          {t('back')}
        </button>
        <button
          className="button button-primary"
          disabled={!props.title.trim()}
          onClick={props.onNext}
          type="button"
        >
          {t('continue')}
        </button>
      </div>
    </>
  );
}

function DynamicField({
  attribute,
  onChange,
  t,
  value
}: {
  attribute: CategoryAttributeContract;
  onChange: (value: DraftAttributeInput | undefined) => void;
  t: Translator;
  value: DraftAttributeInput | undefined;
}) {
  const label = (
    <span>
      {attribute.label} {attribute.required && <b>*</b>}
    </span>
  );
  const help = attribute.helpText && <small>{attribute.helpText}</small>;
  if (attribute.valueType === 'boolean')
    return (
      <label className="field field-check">
        <input
          type="checkbox"
          checked={value?.type === 'boolean' ? value.value : false}
          onChange={(event) =>
            onChange({attributeId: attribute.id, type: 'boolean', value: event.target.checked})
          }
        />
        <span>
          <strong>{attribute.label}</strong>
          {help}
        </span>
      </label>
    );
  if (attribute.valueType === 'single_select')
    return (
      <label className="field">
        {label}
        <select
          value={value?.type === 'single_select' ? value.optionId : ''}
          onChange={(event) =>
            onChange(
              event.target.value
                ? {attributeId: attribute.id, type: 'single_select', optionId: event.target.value}
                : undefined
            )
          }
        >
          <option value="">{t('selectOption')}</option>
          {attribute.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {help}
      </label>
    );
  if (attribute.valueType === 'multi_select') {
    const selected = value?.type === 'multi_select' ? value.optionIds : [];
    return (
      <fieldset className="field field-wide option-field">
        <legend>{label}</legend>
        <div className="option-pills">
          {attribute.options.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={(event) => {
                  const optionIds = event.target.checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id);
                  onChange(
                    optionIds.length
                      ? {attributeId: attribute.id, type: 'multi_select', optionIds}
                      : undefined
                  );
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {help}
      </fieldset>
    );
  }
  if (attribute.valueType === 'text')
    return (
      <label className="field">
        {label}
        <input
          value={value?.type === 'text' ? value.value : ''}
          minLength={attribute.constraints.minLength ?? undefined}
          maxLength={attribute.constraints.maxLength ?? undefined}
          onChange={(event) =>
            onChange(
              event.target.value
                ? {attributeId: attribute.id, type: 'text', value: event.target.value}
                : undefined
            )
          }
        />
        {help}
      </label>
    );
  if (attribute.valueType === 'date')
    return (
      <label className="field">
        {label}
        <input
          type="date"
          value={value?.type === 'date' ? value.value : ''}
          onChange={(event) =>
            onChange(
              event.target.value
                ? {attributeId: attribute.id, type: 'date', value: event.target.value}
                : undefined
            )
          }
        />
        {help}
      </label>
    );
  const numericType =
    attribute.valueType === 'integer'
      ? 'integer'
      : attribute.valueType === 'measurement'
        ? 'measurement'
        : 'decimal';
  const numericValue =
    value && (value.type === 'integer' || value.type === 'decimal' || value.type === 'measurement')
      ? value.value
      : '';
  return (
    <label className="field">
      {label}
      <div className={attribute.unit ? 'input-suffix' : undefined}>
        <input
          type="number"
          inputMode="decimal"
          step={numericType === 'integer' ? 1 : 'any'}
          min={attribute.constraints.minNumeric ?? undefined}
          max={attribute.constraints.maxNumeric ?? undefined}
          value={numericValue}
          onChange={(event) => {
            if (event.target.value === '') return onChange(undefined);
            const number = Number(event.target.value);
            if (numericType === 'integer')
              onChange({attributeId: attribute.id, type: 'integer', value: number});
            else if (numericType === 'measurement')
              onChange({
                attributeId: attribute.id,
                type: 'measurement',
                value: number,
                unit: attribute.unit ?? ''
              });
            else onChange({attributeId: attribute.id, type: 'decimal', value: number});
          }}
        />
        {attribute.unit && <strong>{attribute.unit}</strong>}
      </div>
      {help}
    </label>
  );
}

function LocationStep(props: {
  loading: boolean;
  locationId: string | null;
  options: LocationContract[];
  onBack: () => void;
  onChoose: (location: LocationContract) => void;
  onTrailBack: (index: number) => void;
  onNext: () => void;
  t: Translator;
  trail: LocationContract[];
}) {
  const {t} = props;
  return (
    <>
      <StepHeader number="03" title={t('locationTitle')} text={t('locationText')} />
      <div className="privacy-note">
        <LocationIcon />
        <div>
          <strong>{t('privacyTitle')}</strong>
          <p>{t('privacyText')}</p>
        </div>
      </div>
      <div className="location-breadcrumbs">
        <button onClick={() => props.onTrailBack(-1)} type="button">
          {t('allAzerbaijan')}
        </button>
        {props.trail.map((item, index) => (
          <button key={item.id} onClick={() => props.onTrailBack(index)} type="button">
            {item.name}
          </button>
        ))}
      </div>
      {props.loading ? (
        <SkeletonList />
      ) : props.options.length ? (
        <div className="location-list">
          {props.options.map((location) => (
            <button
              className={props.locationId === location.id ? 'is-selected' : ''}
              key={location.id}
              onClick={() => props.onChoose(location)}
              type="button"
            >
              <span>
                <strong>{location.name}</strong>
                <small>{t(`locationKinds.${location.kind}`)}</small>
              </span>
              {props.locationId === location.id ? <CheckIcon /> : <ChevronIcon />}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <CheckIcon />
          <strong>{props.trail.at(-1)?.name ?? t('locationSelected')}</strong>
          <p>{t('locationLeafText')}</p>
        </div>
      )}
      <div className="form-actions">
        <button className="button button-ghost" onClick={props.onBack} type="button">
          {t('back')}
        </button>
        <button
          className="button button-primary"
          disabled={!props.locationId}
          onClick={props.onNext}
          type="button"
        >
          {t('reviewAction')}
        </button>
      </div>
    </>
  );
}

function ReviewStep(props: {
  canPublish: boolean;
  category: string;
  location: string;
  missing: string[];
  onBack: () => void;
  onEdit: () => void;
  onPublish: () => void;
  price: string;
  publishError: string | null;
  publishing: boolean;
  t: Translator;
  title: string;
}) {
  const {t} = props;
  return (
    <>
      <StepHeader number="04" title={t('reviewTitle')} text={t('reviewText')} />
      {props.missing.length > 0 && (
        <div className="notice notice-warm">
          <AlertIcon />
          <div>
            <strong>{t('missingTitle')}</strong>
            <p>{props.missing.join(', ')}</p>
          </div>
        </div>
      )}
      <div className="listing-preview">
        <div className="preview-image">
          <span>S</span>
          <small>{t('mediaLater')}</small>
        </div>
        <div className="preview-content">
          <span className="preview-category">{props.category}</span>
          <h2>{props.title || t('untitled')}</h2>
          <strong className="preview-price">
            {props.price ? `${props.price} AZN` : t('priceOnRequest')}
          </strong>
          <p>
            <LocationIcon />
            {props.location}
          </p>
        </div>
      </div>
      <div className="notice">
        <SparkIcon />
        <div>
          <strong>{t('foundationReadyTitle')}</strong>
          <p>{t('foundationReadyText')}</p>
        </div>
      </div>
      {props.publishError && (
        <div className="notice notice-error" role="alert">
          <AlertIcon />
          <div>
            <strong>{t('publishError')}</strong>
            <p>{props.publishError}</p>
          </div>
        </div>
      )}
      <div className="form-actions">
        <button className="button button-ghost" onClick={props.onBack} type="button">
          {t('back')}
        </button>
        <button className="button button-secondary" onClick={props.onEdit} type="button">
          {t('editDetails')}
        </button>
        <button
          className="button button-primary"
          disabled={!props.canPublish || props.publishing}
          onClick={props.onPublish}
          type="button"
        >
          {props.publishing ? t('publishing') : t('publishAction')}
        </button>
      </div>
    </>
  );
}

function StepHeader({number, text, title}: {number: string; text: string; title: string}) {
  return (
    <header className="step-header">
      <span>{number}</span>
      <div>
        <h2 id="sell-step-title">{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}
function ErrorState({
  action,
  message,
  onAction
}: {
  action: string;
  message: string;
  onAction: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertIcon />
      <div>
        <strong>{message}</strong>
        <button onClick={onAction} type="button">
          {action}
        </button>
      </div>
    </div>
  );
}
function SkeletonList() {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {[1, 2, 3, 4].map((item) => (
        <span key={item} />
      ))}
    </div>
  );
}
function CategoryGlyph({slug}: {slug: string}) {
  return (
    <span className="category-glyph" aria-hidden="true">
      {slug.slice(0, 1).toUpperCase()}
    </span>
  );
}
function stepIndex(step: Step) {
  return ['category', 'details', 'location', 'review'].indexOf(step);
}
function isPublicLocation(location: LocationContract) {
  return ['city', 'district', 'settlement', 'neighborhood'].includes(location.kind);
}
function precisionFor(location?: LocationContract): 'city' | 'district' | 'neighborhood' {
  if (!location || location.kind === 'city') return 'city';
  if (location.kind === 'neighborhood') return 'neighborhood';
  return 'district';
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 9v5M12 18h.01" />
    </svg>
  );
}
function LocationIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    </svg>
  );
}
