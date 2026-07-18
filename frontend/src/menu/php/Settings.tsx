import type { PhpInstanceProps } from '../../components/PhpCard';

interface Props {
    instance: PhpInstanceProps;
}

export default function PhpSettings({ instance }: Props) {
    return (
        <div className="flex flex-col gap-6">

            {/* Basic php.ini Directives */}
            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Core Limits</h4>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">memory_limit</label>
                        <input type="text" defaultValue={instance.memoryLimit} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_execution_time</label>
                        <input type="number" defaultValue="120" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">upload_max_filesize</label>
                        <input type="text" defaultValue="64M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">post_max_size</label>
                        <input type="text" defaultValue="64M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            {/* Extensions Toggle */}
            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Extensions</h4>
                <div className="grid grid-cols-2 gap-y-3">

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ms-3 text-sm font-medium text-slate-700 dark:text-slate-300">OPcache</span>
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ms-3 text-sm font-medium text-slate-700 dark:text-slate-300">Xdebug</span>
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ms-3 text-sm font-medium text-slate-700 dark:text-slate-300">cURL</span>
                    </label>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        <span className="ms-3 text-sm font-medium text-slate-700 dark:text-slate-300">mbstring</span>
                    </label>

                </div>
            </div>

        </div>
    );
}