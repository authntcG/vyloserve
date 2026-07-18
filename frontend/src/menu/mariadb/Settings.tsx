interface Props {
    instance: any;
}

export default function DbSettings({ instance }: Props) {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Connection</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Port</label>
                        <input type="number" defaultValue={instance.port} className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Bind Address</label>
                        <input type="text" defaultValue="127.0.0.1" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                </div>
            </div>

            <hr className="border-slate-200 dark:border-slate-800" />

            <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Performance (my.ini)</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">innodb_buffer_pool_size</label>
                        <input type="text" defaultValue="256M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">max_allowed_packet</label>
                        <input type="text" defaultValue="64M" className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}