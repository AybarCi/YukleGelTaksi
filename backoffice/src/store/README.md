# Redux Store Yapısı

Bu klasör, uygulamanın Redux state yönetim yapısını içerir. 

## Dosya Yapısı

```
store/
├── actions/              # Redux action'ları ve API çağrıları
│   ├── supportTicketsTypes.ts    # Action tipleri ve interface'ler
│   ├── supportTicketsActions.ts  # Action creators ve async thunk'lar
│   └── index.ts                  # Tüm action'ları bir araya toplayan index
├── reducers/             # Redux reducer'ları
│   ├── supportTicketsReducer.ts  # Support tickets state yönetimi
│   ├── authReducer.ts
│   ├── dashboardReducer.ts
│   ├── usersReducer.ts
│   ├── driversReducer.ts
│   ├── ordersReducer.ts
│   └── monitoringReducer.ts
├── types.ts              # Tüm TypeScript interface'leri
└── index.ts              # Store konfigürasyonu
```

## Yeniden Yapılandırılmış Support Tickets Yapısı

### Actions (Yeni)
- **supportTicketsTypes.ts**: Tüm action tipleri ve TypeScript interface'leri
- **supportTicketsActions.ts**: 
  - Action creators (synchronous)
  - Async thunk'lar (API çağrıları)
  - Hata yönetimi

### Reducer (Güncellenmiş)
- Sadece state yönetimi için sorumlu
- API çağrıları tamamen kaldırıldı
- Action'lara göre state güncellemeleri

## Kullanım

### Component'te Kullanım
```typescript
import { useDispatch, useSelector } from 'react-redux';
import { fetchSupportTickets, updateSupportTicket, updatePagination } from '../store/actions';
import { RootState } from '../store/types';

const dispatch = useDispatch();
const { driverTickets, customerTickets, loading, error, page, rowsPerPage } = useSelector((state: RootState) => state.supportTickets);

// Tickets'ları getir
dispatch(fetchSupportTickets('all'));

// Ticket güncelle
dispatch(updateSupportTicket(ticketId, updateData, 'driver'));

// Sayfalama güncelle
dispatch(updatePagination(0, 10));
```

## Avantajlar

1. **Separation of Concerns**: API çağrıları ve state yönetimi ayrıldı
2. **Daha İyi Test Edilebilirlik**: Reducer'lar saf fonksiyonlar haline geldi
3. **TypeScript Desteği**: Güçlü tip denetimi
4. **Bakım Kolaylığı**: Her bileşen tek sorumluluk ilkesine uyuyor