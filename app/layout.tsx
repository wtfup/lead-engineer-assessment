import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Northstar • Recovery Desk',description:'Synthetic lead-engineer assessment sandbox. Not production.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
