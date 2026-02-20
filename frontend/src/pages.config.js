import History from './pages/History';
import Home from './pages/Home';
import Invoice from './pages/Invoice';
import InvoiceHistory from './pages/InvoiceHistory';
import Settings from './pages/Settings';
import Timer from './pages/Timer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "History": History,
    "Home": Home,
    "Invoice": Invoice,
    "InvoiceHistory": InvoiceHistory,
    "Settings": Settings,
    "Timer": Timer,
}

export const pagesConfig = {
    mainPage: "Timer",
    Pages: PAGES,
    Layout: __Layout,
};