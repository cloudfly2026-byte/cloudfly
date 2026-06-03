import { configureStore } from '@reduxjs/toolkit';
import { contactsApi } from './api/contactsApi';
import notificationReducer from './slices/notificationSlice';
import unreadMessagesReducer from './slices/unreadMessagesSlice';
import dashboardReducer from './slices/dashboardSlice';

export const store = configureStore({
  reducer: {
    notifications: notificationReducer,
    unreadMessages: unreadMessagesReducer,
    dashboard: dashboardReducer,
    [contactsApi.reducerPath]: contactsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(contactsApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
