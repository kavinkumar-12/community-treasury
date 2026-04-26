import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zkurhwgcwbasxcquancj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprdXJod2djd2Jhc3hjcXVhbmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzOTMzMTAsImV4cCI6MjA5MDk2OTMxMH0.U4OFsDcgDOXPpbmSeDERW33tIu59fnjp1QZusU9xofw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);