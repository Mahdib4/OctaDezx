import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button variant="ghost" onClick={toggleTheme} className="flex items-center">
      {theme === 'light' ? (
        <>
          <Moon className="h-5 w-5 mr-2" />
          <span>Dark</span>
        </>
      ) : (
        <>
          <Sun className="h-5 w-5 mr-2" />
          <span>Light</span>
        </>
      )}
    </Button>
  );
};
