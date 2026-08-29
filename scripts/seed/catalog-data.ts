import type {AttributeValueType} from '../../src/modules/catalog/domain';

export const categorySeed = [
  [
    '20000000-0000-4000-8000-000000000001',
    null,
    'transport',
    0,
    10,
    ['Nəqliyyat', 'Транспорт', 'Transport']
  ],
  [
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'cars',
    1,
    10,
    ['Avtomobillər', 'Автомобили', 'Cars']
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000002',
    'passenger-cars',
    2,
    10,
    ['Minik avtomobilləri', 'Легковые автомобили', 'Passenger cars']
  ],
  [
    '20000000-0000-4000-8000-000000000004',
    null,
    'real-estate',
    0,
    20,
    ['Daşınmaz əmlak', 'Недвижимость', 'Real estate']
  ],
  [
    '20000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000004',
    'apartments',
    1,
    10,
    ['Mənzillər', 'Квартиры', 'Apartments']
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000005',
    'apartments-for-sale',
    2,
    10,
    ['Satılan mənzillər', 'Квартиры на продажу', 'Apartments for sale']
  ],
  [
    '20000000-0000-4000-8000-000000000007',
    null,
    'electronics',
    0,
    30,
    ['Elektronika', 'Электроника', 'Electronics']
  ],
  [
    '20000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000007',
    'phones-tablets',
    1,
    10,
    ['Telefonlar və planşetlər', 'Телефоны и планшеты', 'Phones and tablets']
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    '20000000-0000-4000-8000-000000000008',
    'smartphones',
    2,
    10,
    ['Smartfonlar', 'Смартфоны', 'Smartphones']
  ]
] as const;

export interface AttributeSeed {
  id: string;
  key: string;
  valueType: AttributeValueType;
  unit?: string;
  minNumeric?: string;
  maxNumeric?: string;
  minLength?: number;
  maxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  labels: readonly [string, string, string];
}

export const attributeSeed: readonly AttributeSeed[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    key: 'brand',
    valueType: 'single_select',
    labels: ['Brend', 'Бренд', 'Brand']
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    key: 'model',
    valueType: 'text',
    minLength: 1,
    maxLength: 80,
    labels: ['Model', 'Модель', 'Model']
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    key: 'year',
    valueType: 'integer',
    minNumeric: '1900',
    maxNumeric: '2100',
    labels: ['Buraxılış ili', 'Год выпуска', 'Year']
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    key: 'mileage',
    valueType: 'measurement',
    unit: 'km',
    minNumeric: '0',
    maxNumeric: '5000000',
    labels: ['Yürüş', 'Пробег', 'Mileage']
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    key: 'condition',
    valueType: 'single_select',
    labels: ['Vəziyyət', 'Состояние', 'Condition']
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    key: 'vehicle_features',
    valueType: 'multi_select',
    minSelections: 0,
    maxSelections: 12,
    labels: ['Avadanlıq', 'Оснащение', 'Features']
  },
  {
    id: '30000000-0000-4000-8000-000000000007',
    key: 'registration_expiry',
    valueType: 'date',
    labels: ['Qeydiyyatın bitmə tarixi', 'Срок регистрации', 'Registration expiry']
  },
  {
    id: '30000000-0000-4000-8000-000000000008',
    key: 'engine_volume',
    valueType: 'decimal',
    minNumeric: '0.1',
    maxNumeric: '20',
    labels: ['Mühərrik həcmi', 'Объём двигателя', 'Engine volume']
  },
  {
    id: '30000000-0000-4000-8000-000000000009',
    key: 'bedrooms',
    valueType: 'integer',
    minNumeric: '0',
    maxNumeric: '30',
    labels: ['Yataq otaqları', 'Спальни', 'Bedrooms']
  },
  {
    id: '30000000-0000-4000-8000-000000000010',
    key: 'area',
    valueType: 'measurement',
    unit: 'm2',
    minNumeric: '1',
    maxNumeric: '100000',
    labels: ['Sahə', 'Площадь', 'Area']
  },
  {
    id: '30000000-0000-4000-8000-000000000011',
    key: 'furnished',
    valueType: 'boolean',
    labels: ['Mebelli', 'С мебелью', 'Furnished']
  },
  {
    id: '30000000-0000-4000-8000-000000000012',
    key: 'storage_gb',
    valueType: 'integer',
    unit: 'GB',
    minNumeric: '1',
    maxNumeric: '8192',
    labels: ['Yaddaş', 'Память', 'Storage']
  }
];

export const optionSeed = [
  [
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'other',
    100,
    ['Digər', 'Другой', 'Other']
  ],
  [
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000005',
    'new',
    10,
    ['Yeni', 'Новое', 'New']
  ],
  [
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000005',
    'used',
    20,
    ['İşlənmiş', 'Б/у', 'Used']
  ],
  [
    '40000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000006',
    'air-conditioning',
    10,
    ['Kondisioner', 'Кондиционер', 'Air conditioning']
  ],
  [
    '40000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000006',
    'parking-sensors',
    20,
    ['Park sensoru', 'Парктроник', 'Parking sensors']
  ]
] as const;

export const applicabilitySeed = [
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    true,
    true,
    true,
    false,
    10
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    true,
    true,
    true,
    false,
    20
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000003',
    true,
    true,
    false,
    true,
    30
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000004',
    false,
    true,
    false,
    true,
    40
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000005',
    true,
    true,
    false,
    false,
    50
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000006',
    false,
    true,
    true,
    false,
    60
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000007',
    false,
    false,
    false,
    false,
    70
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000008',
    false,
    true,
    false,
    true,
    80
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000009',
    true,
    true,
    false,
    true,
    10
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000010',
    true,
    true,
    false,
    true,
    20
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000011',
    false,
    true,
    false,
    false,
    30
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000005',
    true,
    true,
    false,
    false,
    40
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000001',
    true,
    true,
    true,
    false,
    10
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000002',
    true,
    true,
    true,
    false,
    20
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000012',
    true,
    true,
    false,
    true,
    30
  ],
  [
    '20000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000005',
    true,
    true,
    false,
    false,
    40
  ]
] as const;
