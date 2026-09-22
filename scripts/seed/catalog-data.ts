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
    labels: ['Otaqlar', 'Комнаты', 'Rooms']
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
  },
  {
    id: '30000000-0000-4000-8000-000000000013',
    key: 'property_type',
    valueType: 'single_select',
    labels: ['Tikili növü', 'Тип дома', 'Building type']
  },
  {
    id: '30000000-0000-4000-8000-000000000014',
    key: 'floor',
    valueType: 'integer',
    minNumeric: '0',
    maxNumeric: '200',
    labels: ['Mərtəbə', 'Этаж', 'Floor']
  },
  {
    id: '30000000-0000-4000-8000-000000000015',
    key: 'total_floors',
    valueType: 'integer',
    minNumeric: '1',
    maxNumeric: '200',
    labels: ['Mərtəbələrin sayı', 'Этажей в доме', 'Total floors']
  },
  {
    id: '30000000-0000-4000-8000-000000000016',
    key: 'deed_available',
    valueType: 'boolean',
    labels: ['Çıxarış var', 'Есть купчая', 'Deed available']
  },
  {
    id: '30000000-0000-4000-8000-000000000017',
    key: 'mortgage_available',
    valueType: 'boolean',
    labels: ['İpoteka mümkündür', 'Возможна ипотека', 'Mortgage available']
  },
  {
    id: '30000000-0000-4000-8000-000000000018',
    key: 'fuel_type',
    valueType: 'single_select',
    labels: ['Yanacaq növü', 'Тип топлива', 'Fuel type']
  },
  {
    id: '30000000-0000-4000-8000-000000000019',
    key: 'transmission',
    valueType: 'single_select',
    labels: ['Sürətlər qutusu', 'Коробка передач', 'Transmission']
  },
  {
    id: '30000000-0000-4000-8000-000000000020',
    key: 'body_type',
    valueType: 'single_select',
    labels: ['Ban növü', 'Тип кузова', 'Body type']
  },
  {
    id: '30000000-0000-4000-8000-000000000021',
    key: 'repair_condition',
    valueType: 'single_select',
    labels: ['Təmir vəziyyəti', 'Состояние ремонта', 'Repair condition']
  }
];

type OptionSeed = readonly [
  id: string,
  attributeId: string,
  key: string,
  sortOrder: number,
  labels: readonly [string, string, string]
];

// Snapshot of passenger-car makes offered by the Azerbaijan market reference on 2026-09-23.
// Keep the array append-only: generated IDs are stable as long as existing positions do not move.
const passengerCarBrands = [
  'Abarth',
  'Acura',
  'Alfa Romeo',
  'Aston Martin',
  'Audi',
  'Avatr',
  'Baic',
  'BAW',
  'Bentley',
  'Bestune',
  'BMW',
  'BMW Alpina',
  'Buick',
  'BYD',
  'Cadillac',
  'Changan',
  'Chery',
  'Chevrolet',
  'Chrysler',
  'Citroen',
  'Dacia',
  'Daewoo',
  'Daihatsu',
  'Denza',
  'DFSK',
  'Dodge',
  'DongFeng',
  'FAW',
  'Ferrari',
  'Fiat',
  'Ford',
  'Forthing',
  'GAC',
  'GAZ',
  'Geely',
  'Genesis',
  'GMC',
  'GWM (Great Wall Motor)',
  'Haval',
  'Honda',
  'Hongqi',
  'Hummer',
  'Hyundai',
  'iCar',
  'IM',
  'Infiniti',
  'Iran Khodro',
  'Isuzu',
  'JAC',
  'JAECOO',
  'Jaguar',
  'Jeep',
  'JETOUR',
  'JMC',
  'KAIYI',
  'Karry',
  'Khazar',
  'Kia',
  'LADA (VAZ)',
  'Lamborghini',
  'Land Rover',
  'Leapmotor',
  'Lexus',
  'Li Auto',
  'Lifan',
  'Lincoln',
  'Lotus',
  'LuAz',
  'Lynk & Co',
  'M-Hero',
  'Maextro',
  'Maple',
  'Maserati',
  'Mazda',
  'Mercedes-Benz',
  'Mercedes-Maybach',
  'Mercury',
  'MG',
  'Mini',
  'Mitsubishi',
  'Moskvich',
  'Neta',
  'Nio',
  'Nissan',
  'Opel',
  'Peugeot',
  'Polestar',
  'Porsche',
  'Radar',
  'Ravon',
  'Renault',
  'Renault Samsung',
  'Rolls-Royce',
  'Rover',
  'ROX (Polar Stone)',
  'Saab',
  'Saipa',
  'Saturn',
  'Scion',
  'SEAT',
  'Seres Aito',
  'Skoda',
  'Smart',
  'Soueast',
  'SsangYong',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Tofas',
  'Toyota',
  'UAZ',
  'VGV',
  'Volkswagen',
  'Volvo',
  'Voyah',
  'Wuling',
  'Xiaomi',
  'XPeng',
  'ZAZ',
  'ZEEKR',
  'ZX Auto'
] as const;

const preservedBrandOptionIds: Partial<Record<(typeof passengerCarBrands)[number], string>> = {
  BMW: '40000000-0000-4000-8000-000000000008',
  Hyundai: '40000000-0000-4000-8000-000000000009',
  Kia: '40000000-0000-4000-8000-000000000010',
  'LADA (VAZ)': '40000000-0000-4000-8000-000000000011',
  'Mercedes-Benz': '40000000-0000-4000-8000-000000000007',
  Toyota: '40000000-0000-4000-8000-000000000006'
};

const brandOptionSeed: readonly OptionSeed[] = passengerCarBrands.map((label, index) => [
  preservedBrandOptionIds[label] ??
    `41000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
  '30000000-0000-4000-8000-000000000001',
  label
    .toLocaleLowerCase('en')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, ''),
  (index + 1) * 10,
  [label, label, label]
]);

export const retiredOptionIds = [
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000015',
  '40000000-0000-4000-8000-000000000016'
] as const;

export const optionSeed: readonly OptionSeed[] = [
  ...brandOptionSeed,
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
  ],
  [
    '40000000-0000-4000-8000-000000000012',
    '30000000-0000-4000-8000-000000000013',
    'new-building',
    10,
    ['Yeni tikili', 'Новостройка', 'New building']
  ],
  [
    '40000000-0000-4000-8000-000000000013',
    '30000000-0000-4000-8000-000000000013',
    'old-building',
    20,
    ['Köhnə tikili', 'Вторичный фонд', 'Existing building']
  ],
  [
    '40000000-0000-4000-8000-000000000014',
    '30000000-0000-4000-8000-000000000021',
    'no-repair',
    10,
    ['Təmirsiz', 'Без ремонта', 'Unfinished']
  ],
  [
    '40000000-0000-4000-8000-000000000015',
    '30000000-0000-4000-8000-000000000021',
    'needs-repair',
    20,
    ['Təmir tələb edir', 'Требует ремонта', 'Needs renovation']
  ],
  [
    '40000000-0000-4000-8000-000000000016',
    '30000000-0000-4000-8000-000000000021',
    'good',
    30,
    ['Yaxşı', 'Хорошее', 'Good']
  ],
  [
    '40000000-0000-4000-8000-000000000017',
    '30000000-0000-4000-8000-000000000021',
    'renovated',
    40,
    ['Təmirli', 'С ремонтом', 'Renovated']
  ],
  [
    '40000000-0000-4000-8000-000000000018',
    '30000000-0000-4000-8000-000000000018',
    'petrol',
    10,
    ['Benzin', 'Бензин', 'Petrol']
  ],
  [
    '40000000-0000-4000-8000-000000000019',
    '30000000-0000-4000-8000-000000000018',
    'diesel',
    20,
    ['Dizel', 'Дизель', 'Diesel']
  ],
  [
    '40000000-0000-4000-8000-000000000020',
    '30000000-0000-4000-8000-000000000018',
    'hybrid',
    30,
    ['Hibrid', 'Гибрид', 'Hybrid']
  ],
  [
    '40000000-0000-4000-8000-000000000021',
    '30000000-0000-4000-8000-000000000018',
    'electric',
    40,
    ['Elektro', 'Электро', 'Electric']
  ],
  [
    '40000000-0000-4000-8000-000000000022',
    '30000000-0000-4000-8000-000000000018',
    'gas',
    50,
    ['Qaz', 'Газ', 'Gas']
  ],
  [
    '40000000-0000-4000-8000-000000000023',
    '30000000-0000-4000-8000-000000000019',
    'automatic',
    10,
    ['Avtomat', 'Автомат', 'Automatic']
  ],
  [
    '40000000-0000-4000-8000-000000000024',
    '30000000-0000-4000-8000-000000000019',
    'manual',
    20,
    ['Mexaniki', 'Механика', 'Manual']
  ],
  [
    '40000000-0000-4000-8000-000000000025',
    '30000000-0000-4000-8000-000000000019',
    'robot',
    30,
    ['Robot', 'Робот', 'Automated manual']
  ],
  [
    '40000000-0000-4000-8000-000000000026',
    '30000000-0000-4000-8000-000000000019',
    'cvt',
    40,
    ['Variator', 'Вариатор', 'CVT']
  ],
  [
    '40000000-0000-4000-8000-000000000027',
    '30000000-0000-4000-8000-000000000020',
    'sedan',
    10,
    ['Sedan', 'Седан', 'Sedan']
  ],
  [
    '40000000-0000-4000-8000-000000000028',
    '30000000-0000-4000-8000-000000000020',
    'suv',
    20,
    ['SUV', 'Внедорожник / SUV', 'SUV']
  ],
  [
    '40000000-0000-4000-8000-000000000029',
    '30000000-0000-4000-8000-000000000020',
    'hatchback',
    30,
    ['Hetçbek', 'Хэтчбек', 'Hatchback']
  ],
  [
    '40000000-0000-4000-8000-000000000030',
    '30000000-0000-4000-8000-000000000020',
    'coupe',
    40,
    ['Kupe', 'Купе', 'Coupe']
  ],
  [
    '40000000-0000-4000-8000-000000000031',
    '30000000-0000-4000-8000-000000000020',
    'wagon',
    50,
    ['Universal', 'Универсал', 'Wagon']
  ],
  [
    '40000000-0000-4000-8000-000000000032',
    '30000000-0000-4000-8000-000000000020',
    'minivan',
    60,
    ['Miniven', 'Минивэн', 'Minivan']
  ],
  [
    '40000000-0000-4000-8000-000000000033',
    '30000000-0000-4000-8000-000000000020',
    'pickup',
    70,
    ['Pikap', 'Пикап', 'Pickup']
  ],
  [
    '40000000-0000-4000-8000-000000000034',
    '30000000-0000-4000-8000-000000000020',
    'liftback',
    80,
    ['Liftbek', 'Лифтбек', 'Liftback']
  ],
  [
    '40000000-0000-4000-8000-000000000035',
    '30000000-0000-4000-8000-000000000020',
    'cabriolet',
    90,
    ['Kabriolet', 'Кабриолет', 'Cabriolet']
  ],
  [
    '40000000-0000-4000-8000-000000000036',
    '30000000-0000-4000-8000-000000000020',
    'roadster',
    100,
    ['Rodster', 'Родстер', 'Roadster']
  ],
  [
    '40000000-0000-4000-8000-000000000037',
    '30000000-0000-4000-8000-000000000021',
    'cosmetic-repair',
    20,
    ['Kosmetik təmir', 'Косметический ремонт', 'Cosmetic renovation']
  ]
];

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
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000018',
    false,
    true,
    false,
    false,
    90
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000019',
    false,
    true,
    false,
    false,
    100
  ],
  [
    '20000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000020',
    false,
    true,
    false,
    false,
    110
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000013',
    false,
    true,
    false,
    false,
    5
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
    '30000000-0000-4000-8000-000000000014',
    false,
    true,
    false,
    true,
    40
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000015',
    false,
    false,
    false,
    true,
    50
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000021',
    false,
    true,
    false,
    false,
    60
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000016',
    false,
    true,
    false,
    false,
    70
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000017',
    false,
    true,
    false,
    false,
    80
  ],
  [
    '20000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000005',
    false,
    false,
    false,
    false,
    999
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
