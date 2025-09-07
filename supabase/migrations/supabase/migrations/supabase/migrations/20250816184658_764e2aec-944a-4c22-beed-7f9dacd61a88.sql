-- Fix linter: Set immutable search_path for functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = public;