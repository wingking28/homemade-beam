import { createContext, useContext } from 'react';

type TabNavigationContextValue = {
  goToTab: (index: number) => void;
};

export const TabNavigationContext = createContext<TabNavigationContextValue>({
  goToTab: () => {},
});

export const useTabNavigation = () => useContext(TabNavigationContext);
