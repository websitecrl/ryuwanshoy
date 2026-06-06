import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client'

type Options = { 
    // Unique name for this channel 
    channelName: string;
    // One or more tables to listen to
    tables: string[];
    // call when change is detected
    onChange: () => void;
};

export function useRealtimeSubscription({
    channelName,
    tables,
    onChange,
}: Options) {
    useEffect(() => {
        const supabase = createClient();

        //Build the channel - chain .on() for each table dynamically
        let channel = supabase.channel(channelName);

        for (const table of tables) {
            channel = channel.on( "postgres_changes", { event: '*', schema: 'public', table }, onChange);
        }

        channel.subscribe();

        //Cleanup on unmount 
        return () => {
            supabase.removeChannel(channel);
        };
    }, [channelName, tables, onChange]);
}