// The reader's self reported age band (13, 16 or 18), saved by the AgeGate.
// Read it with useSavedAge / useMaxAge (src/hooks/useSavedAge.ts).
export const AGE_KEY = 'ryu-age'

// Highest min_age shown before the reader's age is known. Public pages are
// cached and shared by every visitor, so their HTML can only hold what anyone
// may see. A series with no min_age counts as all ages.
export const ALL_AGES = 13

// Set on <html> when an age is saved. CSS hides the gate off it (globals.css),
// so a returning reader never sees the gate flash before React loads.
export const AGE_CONFIRMED_ATTR = 'data-age-confirmed'

// Set on <html> to the saved age band ("13", "16" or "18"). CSS hides age
// restricted pages off it before first paint (globals.css, AgeRestricted).
export const READER_AGE_ATTR = 'data-reader-age'

// Inlined in <head> next to THEME_INIT_SCRIPT, so the attributes are set
// before first paint.
export const AGE_INIT_SCRIPT = `(function(){try{var a=localStorage.getItem('${AGE_KEY}');if(a!==null){var h=document.documentElement;h.setAttribute('${AGE_CONFIRMED_ATTR}','');h.setAttribute('${READER_AGE_ATTR}',a)}}catch(e){}})()`
