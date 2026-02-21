import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Navbar } from '@/components/navbar';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <HomeLayout
      {...baseOptions()}
      nav={{ ...baseOptions().nav, component: <Navbar /> }}
    >
      {children}
    </HomeLayout>
  );
}
