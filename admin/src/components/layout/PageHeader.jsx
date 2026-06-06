export default function PageHeader({ title, mobileTitle, description, children, mobileAction }) {
  return (
    <div className="mb-3 sm:mb-6">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold leading-tight text-maroon sm:text-2xl">
            {mobileTitle ? (
              <>
                <span className="sm:hidden">{mobileTitle}</span>
                <span className="hidden sm:inline">{title}</span>
              </>
            ) : (
              title
            )}
          </h1>
          {description ? (
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{description}</p>
          ) : null}
        </div>
        {mobileAction ? <div className="shrink-0 sm:hidden">{mobileAction}</div> : null}
        {children ? (
          <div className="hidden shrink-0 flex-wrap justify-end gap-2 sm:flex">{children}</div>
        ) : null}
      </div>
    </div>
  )
}
