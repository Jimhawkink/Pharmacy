'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

export interface Outlet {
    outlet_id: number;
    outlet_name: string;
    outlet_code: string;
    address: string;
    city: string;
    phone: string;
    is_main: boolean;
    active: boolean;
}

interface OutletContextType {
    activeOutlet: Outlet | null;
    outlets: Outlet[];
    isMainOutlet: boolean;
    switchOutlet: (outletId: number) => void;
    reloadOutlets: () => Promise<void>;
    outletFilter: (query: any) => any; // helper to add .eq('outlet_id', id) to Supabase queries
}

const OutletContext = createContext<OutletContextType>({
    activeOutlet: null,
    outlets: [],
    isMainOutlet: false,
    switchOutlet: () => { },
    reloadOutlets: async () => { },
    outletFilter: (q: any) => q,
});

export const useOutlet = () => useContext(OutletContext);

export function OutletProvider({ children }: { children: ReactNode }) {
    const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
    const [outlets, setOutlets] = useState<Outlet[]>([]);

    const loadOutlets = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('pharmacy_outlets')
                .select('*')
                .eq('active', true)
                .order('is_main', { ascending: false })
                .order('outlet_name');
            if (error) throw error;
            setOutlets(data || []);

            // Restore active outlet from localStorage
            const savedOutletId = localStorage.getItem('activeOutletId');
            if (savedOutletId && data) {
                const found = data.find(o => o.outlet_id === parseInt(savedOutletId));
                if (found) {
                    setActiveOutlet(found);
                    return;
                }
            }
            // Default to main outlet or first outlet
            if (data && data.length > 0) {
                const main = data.find(o => o.is_main) || data[0];
                setActiveOutlet(main);
                localStorage.setItem('activeOutletId', String(main.outlet_id));
                localStorage.setItem('activeOutletName', main.outlet_name);
            }
        } catch (err) {
            console.error('Failed to load outlets:', err);
            // Fallback: create a default outlet object
            const fallback: Outlet = {
                outlet_id: 1, outlet_name: 'Main Pharmacy', outlet_code: 'MAIN',
                address: '', city: '', phone: '', is_main: true, active: true,
            };
            setOutlets([fallback]);
            setActiveOutlet(fallback);
        }
    }, []);

    useEffect(() => { loadOutlets(); }, [loadOutlets]);

    const switchOutlet = (outletId: number) => {
        const outlet = outlets.find(o => o.outlet_id === outletId);
        if (outlet) {
            setActiveOutlet(outlet);
            localStorage.setItem('activeOutletId', String(outlet.outlet_id));
            localStorage.setItem('activeOutletName', outlet.outlet_name);
        }
    };

    // Helper: adds outlet_id filter to any Supabase query
    const outletFilter = (query: any) => {
        if (activeOutlet) {
            return query.eq('outlet_id', activeOutlet.outlet_id);
        }
        return query;
    };

    return (
        <OutletContext.Provider value={{
            activeOutlet,
            outlets,
            isMainOutlet: activeOutlet?.is_main ?? false,
            switchOutlet,
            reloadOutlets: loadOutlets,
            outletFilter,
        }}>
            {children}
        </OutletContext.Provider>
    );
}
