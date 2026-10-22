// The reader's self reported age band (13, 16 or 18). Read it with useSavedAge / useMaxAge.
export const AGE_KEY = 'ryu-age'

// Highest min_age shown before the age is known: cached public HTML may only hold what anyone may see.
export const ALL_AGES = 13

/** The one age rule for every list: does a series (null min_age = all ages) fit maxAge? */
export function fitsAge(minAge: number | null | undefined, maxAge: number): boolean {
  return (minAge ?? ALL_AGES) <= maxAge
}

// Set on <html> when an age is saved, so CSS hides the gate before React loads.
export const AGE_CONFIRMED_ATTR = 'data-age-confirmed'

// Set on <html> to the saved band, so CSS hides restricted pages before first paint.
export const READER_AGE_ATTR = 'data-reader-age'

// Inlined in <head> so the attributes are set before first paint.
export const AGE_INIT_SCRIPT = `(function(){try{var a=localStorage.getItem('${AGE_KEY}');if(a!==null){var h=document.documentElement;h.setAttribute('${AGE_CONFIRMED_ATTR}','');h.setAttribute('${READER_AGE_ATTR}',a)}}catch(e){}})()`
