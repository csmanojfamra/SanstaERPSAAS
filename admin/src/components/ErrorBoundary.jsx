import { Component } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </AlertDescription>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}
